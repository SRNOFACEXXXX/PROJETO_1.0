// mem-inspector — Windows process memory inspector / debugger helper
// -----------------------------------------------------------------------------
// Purpose: attach to a process YOU own/control (e.g. your own app while
// debugging) and inspect its live runtime memory: enumerate committed regions,
// read typed values at an address, hex-dump a range, scan for a value to locate
// a variable, or dump committed regions to disk for offline analysis.
//
// This is a debugging/inspection tool. It uses only documented Win32 APIs
// (OpenProcess + ReadProcessMemory + VirtualQueryEx) and never writes to the
// target. Use it only on processes you are authorized to inspect.
//
// Build (MSVC, from a "x64 Native Tools" prompt):
//     cl /EHsc /O2 /std:c++17 main.cpp /Fe:mem-inspector.exe
// Build (MinGW-w64):
//     x86_64-w64-mingw32-g++ -O2 -std=c++17 main.cpp -o mem-inspector.exe -lpsapi
//
// Build it as 64-bit to inspect 64-bit targets (a 32-bit build cannot read a
// 64-bit process's full address space).
// -----------------------------------------------------------------------------

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <algorithm>
#include <fstream>
#include <sstream>

namespace {

// --- small helpers ----------------------------------------------------------

void printUsage(const char* argv0) {
    std::printf(
        "mem-inspector — inspect the live memory of a process you control\n\n"
        "Usage:\n"
        "  %s list                                   List running processes (name + PID)\n"
        "  %s regions <pid> [--all]                  List committed memory regions\n"
        "                                            (default: only readable; --all incl. guard/no-access)\n"
        "  %s read <pid> <addr> <type> [count]       Read typed value(s) at address\n"
        "  %s hex  <pid> <addr> <size>               Hex-dump <size> bytes at address\n"
        "  %s dump <pid> <addr> <size> <outfile>     Dump raw bytes to a file\n"
        "  %s dumpall <pid> <outdir> [--max MB]      Dump every committed readable region to <outdir>\n"
        "  %s scan <pid> <type> <value>              Scan all readable regions for a value\n\n"
        "Address: hex (0x1A2B3C) or decimal.\n"
        "Types:   u8 i8 u16 i16 u32 i32 u64 i64 f32 f64 str (str = null/len limited ASCII)\n\n"
        "Examples:\n"
        "  %s list\n"
        "  %s regions 4242\n"
        "  %s scan 4242 i32 1337           # find where the int 1337 lives\n"
        "  %s read 4242 0x7ff6000012a0 i32\n"
        "  %s hex  4242 0x7ff6000012a0 64\n"
        "  %s dumpall 4242 .\\dump --max 32\n",
        argv0, argv0, argv0, argv0, argv0, argv0, argv0,
        argv0, argv0, argv0, argv0, argv0);
}

bool parseAddress(const std::string& s, uint64_t& out) {
    try {
        size_t idx = 0;
        if (s.size() > 2 && (s[0] == '0') && (s[1] == 'x' || s[1] == 'X'))
            out = std::stoull(s.substr(2), &idx, 16);
        else
            out = std::stoull(s, &idx, 10);
        return true;
    } catch (...) {
        return false;
    }
}

const char* protToStr(DWORD p) {
    switch (p & 0xFF) {
        case PAGE_NOACCESS:          return "---";
        case PAGE_READONLY:          return "r--";
        case PAGE_READWRITE:         return "rw-";
        case PAGE_WRITECOPY:         return "rc-";
        case PAGE_EXECUTE:           return "--x";
        case PAGE_EXECUTE_READ:      return "r-x";
        case PAGE_EXECUTE_READWRITE: return "rwx";
        case PAGE_EXECUTE_WRITECOPY: return "rcx";
        default:                     return "???";
    }
}

bool isReadable(const MEMORY_BASIC_INFORMATION& mbi) {
    if (mbi.State != MEM_COMMIT) return false;
    if (mbi.Protect & (PAGE_GUARD | PAGE_NOACCESS)) return false;
    DWORD p = mbi.Protect & 0xFF;
    return p == PAGE_READONLY || p == PAGE_READWRITE || p == PAGE_WRITECOPY ||
           p == PAGE_EXECUTE_READ || p == PAGE_EXECUTE_READWRITE ||
           p == PAGE_EXECUTE_WRITECOPY;
}

HANDLE openTarget(DWORD pid) {
    HANDLE h = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
    if (!h) {
        std::fprintf(stderr,
            "error: OpenProcess(pid=%lu) failed (GetLastError=%lu).\n"
            "  - Is the PID correct and the process still running?\n"
            "  - Run this tool elevated (Administrator) if the target needs it.\n"
            "  - A 32-bit build cannot open a 64-bit target; build x64.\n",
            pid, GetLastError());
    }
    return h;
}

// --- commands ----------------------------------------------------------------

int cmdList() {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) {
        std::fprintf(stderr, "error: CreateToolhelp32Snapshot failed (%lu)\n", GetLastError());
        return 1;
    }
    PROCESSENTRY32W pe{};
    pe.dwSize = sizeof(pe);
    std::printf("%8s  %s\n", "PID", "NAME");
    if (Process32FirstW(snap, &pe)) {
        do {
            char name[MAX_PATH];
            int n = WideCharToMultiByte(CP_UTF8, 0, pe.szExeFile, -1, name, sizeof(name), nullptr, nullptr);
            if (n <= 0) name[0] = '\0';
            std::printf("%8lu  %s\n", pe.th32ProcessID, name);
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return 0;
}

int cmdRegions(DWORD pid, bool all) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;

    SYSTEM_INFO si{};
    GetSystemInfo(&si);
    uint64_t addr = (uint64_t)si.lpMinimumApplicationAddress;
    uint64_t maxAddr = (uint64_t)si.lpMaximumApplicationAddress;

    std::printf("%-18s  %-12s  %-4s  %-10s  %s\n",
                "BASE", "SIZE", "PROT", "TYPE", "STATE");
    uint64_t total = 0, count = 0;
    MEMORY_BASIC_INFORMATION mbi{};
    while (addr < maxAddr && VirtualQueryEx(h, (LPCVOID)addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
        bool show = all ? (mbi.State == MEM_COMMIT) : isReadable(mbi);
        if (show) {
            const char* type =
                mbi.Type == MEM_IMAGE   ? "image"   :
                mbi.Type == MEM_MAPPED  ? "mapped"  :
                mbi.Type == MEM_PRIVATE ? "private" : "-";
            std::printf("0x%016llx  %12llu  %-4s  %-10s  commit\n",
                        (unsigned long long)mbi.BaseAddress,
                        (unsigned long long)mbi.RegionSize,
                        protToStr(mbi.Protect), type);
            total += mbi.RegionSize;
            ++count;
        }
        uint64_t next = (uint64_t)mbi.BaseAddress + mbi.RegionSize;
        if (next <= addr) break;  // guard against overflow/stall
        addr = next;
    }
    std::printf("\n%llu regions, %.2f MB committed%s\n",
                (unsigned long long)count, total / (1024.0 * 1024.0),
                all ? "" : " (readable)");
    CloseHandle(h);
    return 0;
}

void hexDump(const uint8_t* buf, size_t len, uint64_t baseAddr) {
    for (size_t i = 0; i < len; i += 16) {
        std::printf("0x%016llx  ", (unsigned long long)(baseAddr + i));
        for (size_t j = 0; j < 16; ++j) {
            if (i + j < len) std::printf("%02x ", buf[i + j]);
            else             std::printf("   ");
            if (j == 7) std::printf(" ");
        }
        std::printf(" |");
        for (size_t j = 0; j < 16 && i + j < len; ++j) {
            uint8_t c = buf[i + j];
            std::printf("%c", (c >= 0x20 && c < 0x7f) ? c : '.');
        }
        std::printf("|\n");
    }
}

int cmdHex(DWORD pid, uint64_t addr, size_t size) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;
    std::vector<uint8_t> buf(size);
    SIZE_T got = 0;
    if (!ReadProcessMemory(h, (LPCVOID)addr, buf.data(), size, &got) && got == 0) {
        std::fprintf(stderr, "error: ReadProcessMemory failed (%lu)\n", GetLastError());
        CloseHandle(h);
        return 1;
    }
    hexDump(buf.data(), got, addr);
    if (got < size)
        std::printf("(read %llu of %llu bytes; region boundary hit)\n",
                    (unsigned long long)got, (unsigned long long)size);
    CloseHandle(h);
    return 0;
}

template <typename T>
bool readPod(HANDLE h, uint64_t addr, T& out) {
    SIZE_T got = 0;
    return ReadProcessMemory(h, (LPCVOID)addr, &out, sizeof(T), &got) && got == sizeof(T);
}

int cmdRead(DWORD pid, uint64_t addr, const std::string& type, size_t count) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;
    int rc = 0;

    auto readN = [&](auto tag, const char* fmt, size_t stride) {
        using T = decltype(tag);
        for (size_t i = 0; i < count; ++i) {
            T v{};
            uint64_t a = addr + i * stride;
            if (readPod<T>(h, a, v)) {
                std::printf("0x%016llx  ", (unsigned long long)a);
                std::printf(fmt, v);
                std::printf("\n");
            } else {
                std::fprintf(stderr, "error: read failed at 0x%llx (%lu)\n",
                             (unsigned long long)a, GetLastError());
                rc = 1;
                break;
            }
        }
    };

    if      (type == "u8")  readN((uint8_t)0,  "%u",   1);
    else if (type == "i8")  readN((int8_t)0,   "%d",   1);
    else if (type == "u16") readN((uint16_t)0, "%u",   2);
    else if (type == "i16") readN((int16_t)0,  "%d",   2);
    else if (type == "u32") readN((uint32_t)0, "%u",   4);
    else if (type == "i32") readN((int32_t)0,  "%d",   4);
    else if (type == "u64") readN((uint64_t)0, "%llu", 8);
    else if (type == "i64") readN((int64_t)0,  "%lld", 8);
    else if (type == "f32") readN((float)0,    "%g",   4);
    else if (type == "f64") readN((double)0,   "%g",   8);
    else if (type == "str") {
        std::string s;
        for (size_t i = 0; i < 4096; ++i) {
            uint8_t c{};
            if (!readPod<uint8_t>(h, addr + i, c) || c == 0) break;
            s.push_back((char)c);
        }
        std::printf("0x%016llx  \"%s\"\n", (unsigned long long)addr, s.c_str());
    } else {
        std::fprintf(stderr, "error: unknown type '%s'\n", type.c_str());
        rc = 1;
    }

    CloseHandle(h);
    return rc;
}

int cmdDump(DWORD pid, uint64_t addr, size_t size, const std::string& outfile) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;
    std::vector<uint8_t> buf(size);
    SIZE_T got = 0;
    ReadProcessMemory(h, (LPCVOID)addr, buf.data(), size, &got);
    if (got == 0) {
        std::fprintf(stderr, "error: read nothing at 0x%llx (%lu)\n",
                     (unsigned long long)addr, GetLastError());
        CloseHandle(h);
        return 1;
    }
    std::ofstream f(outfile, std::ios::binary);
    if (!f) {
        std::fprintf(stderr, "error: cannot open '%s' for writing\n", outfile.c_str());
        CloseHandle(h);
        return 1;
    }
    f.write(reinterpret_cast<const char*>(buf.data()), (std::streamsize)got);
    std::printf("wrote %llu bytes to %s\n", (unsigned long long)got, outfile.c_str());
    CloseHandle(h);
    return 0;
}

int cmdDumpAll(DWORD pid, const std::string& outdir, uint64_t maxBytes) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;

    CreateDirectoryA(outdir.c_str(), nullptr);  // ok if it already exists

    SYSTEM_INFO si{};
    GetSystemInfo(&si);
    uint64_t addr = (uint64_t)si.lpMinimumApplicationAddress;
    uint64_t maxAddr = (uint64_t)si.lpMaximumApplicationAddress;

    uint64_t dumped = 0, regions = 0, skipped = 0;
    MEMORY_BASIC_INFORMATION mbi{};
    std::vector<uint8_t> buf;

    while (addr < maxAddr && VirtualQueryEx(h, (LPCVOID)addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
        if (isReadable(mbi)) {
            if (maxBytes && mbi.RegionSize > maxBytes) {
                ++skipped;
            } else {
                buf.resize(mbi.RegionSize);
                SIZE_T got = 0;
                if (ReadProcessMemory(h, mbi.BaseAddress, buf.data(), mbi.RegionSize, &got) && got > 0) {
                    std::ostringstream name;
                    name << outdir << "\\region_0x" << std::hex
                         << (unsigned long long)mbi.BaseAddress << ".bin";
                    std::ofstream f(name.str(), std::ios::binary);
                    if (f) {
                        f.write(reinterpret_cast<const char*>(buf.data()), (std::streamsize)got);
                        dumped += got;
                        ++regions;
                    }
                }
            }
        }
        uint64_t next = (uint64_t)mbi.BaseAddress + mbi.RegionSize;
        if (next <= addr) break;
        addr = next;
    }
    std::printf("dumped %llu regions, %.2f MB to %s (%llu skipped over size cap)\n",
                (unsigned long long)regions, dumped / (1024.0 * 1024.0),
                outdir.c_str(), (unsigned long long)skipped);
    CloseHandle(h);
    return 0;
}

// Scan readable regions for a literal value of the given type.
int cmdScan(DWORD pid, const std::string& type, const std::string& valueStr) {
    HANDLE h = openTarget(pid);
    if (!h) return 1;

    std::vector<uint8_t> needle;
    auto push = [&](const void* p, size_t n) {
        const uint8_t* b = reinterpret_cast<const uint8_t*>(p);
        needle.insert(needle.end(), b, b + n);
    };

    try {
        if      (type == "u8")  { uint8_t  v = (uint8_t)std::stoul(valueStr);   push(&v, 1); }
        else if (type == "i8")  { int8_t   v = (int8_t)std::stoi(valueStr);     push(&v, 1); }
        else if (type == "u16") { uint16_t v = (uint16_t)std::stoul(valueStr);  push(&v, 2); }
        else if (type == "i16") { int16_t  v = (int16_t)std::stoi(valueStr);    push(&v, 2); }
        else if (type == "u32") { uint32_t v = (uint32_t)std::stoul(valueStr);  push(&v, 4); }
        else if (type == "i32") { int32_t  v = (int32_t)std::stol(valueStr);    push(&v, 4); }
        else if (type == "u64") { uint64_t v = std::stoull(valueStr);           push(&v, 8); }
        else if (type == "i64") { int64_t  v = std::stoll(valueStr);            push(&v, 8); }
        else if (type == "f32") { float    v = std::stof(valueStr);             push(&v, 4); }
        else if (type == "f64") { double   v = std::stod(valueStr);             push(&v, 8); }
        else if (type == "str") { for (char c : valueStr) needle.push_back((uint8_t)c); }
        else { std::fprintf(stderr, "error: unknown type '%s'\n", type.c_str()); CloseHandle(h); return 1; }
    } catch (...) {
        std::fprintf(stderr, "error: cannot parse value '%s' as %s\n", valueStr.c_str(), type.c_str());
        CloseHandle(h);
        return 1;
    }

    SYSTEM_INFO si{};
    GetSystemInfo(&si);
    uint64_t addr = (uint64_t)si.lpMinimumApplicationAddress;
    uint64_t maxAddr = (uint64_t)si.lpMaximumApplicationAddress;

    MEMORY_BASIC_INFORMATION mbi{};
    std::vector<uint8_t> buf;
    uint64_t hits = 0;
    const uint64_t HIT_CAP = 1000;

    while (addr < maxAddr && VirtualQueryEx(h, (LPCVOID)addr, &mbi, sizeof(mbi)) == sizeof(mbi)) {
        if (isReadable(mbi)) {
            buf.resize(mbi.RegionSize);
            SIZE_T got = 0;
            if (ReadProcessMemory(h, mbi.BaseAddress, buf.data(), mbi.RegionSize, &got) && got >= needle.size()) {
                const uint8_t* begin = buf.data();
                const uint8_t* end   = buf.data() + got;
                const uint8_t* it    = begin;
                while (true) {
                    it = std::search(it, end, needle.begin(), needle.end());
                    if (it == end) break;
                    uint64_t foundAt = (uint64_t)mbi.BaseAddress + (uint64_t)(it - begin);
                    std::printf("0x%016llx\n", (unsigned long long)foundAt);
                    if (++hits >= HIT_CAP) {
                        std::printf("(stopped at %llu hits)\n", (unsigned long long)HIT_CAP);
                        CloseHandle(h);
                        return 0;
                    }
                    ++it;
                }
            }
        }
        uint64_t next = (uint64_t)mbi.BaseAddress + mbi.RegionSize;
        if (next <= addr) break;
        addr = next;
    }
    std::printf("(%llu match%s)\n", (unsigned long long)hits, hits == 1 ? "" : "es");
    CloseHandle(h);
    return 0;
}

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) { printUsage(argv[0]); return 1; }
    std::string cmd = argv[1];

    auto needPid = [&](int at) -> long {
        if (argc <= at) { std::fprintf(stderr, "error: missing <pid>\n"); return -1; }
        try { return std::stol(argv[at]); } catch (...) { std::fprintf(stderr, "error: bad pid\n"); return -1; }
    };

    if (cmd == "list") {
        return cmdList();
    }
    if (cmd == "regions") {
        long pid = needPid(2); if (pid < 0) return 1;
        bool all = (argc >= 4 && std::string(argv[3]) == "--all");
        return cmdRegions((DWORD)pid, all);
    }
    if (cmd == "read") {
        long pid = needPid(2); if (pid < 0) return 1;
        if (argc < 5) { std::fprintf(stderr, "error: read <pid> <addr> <type> [count]\n"); return 1; }
        uint64_t addr; if (!parseAddress(argv[3], addr)) { std::fprintf(stderr, "error: bad addr\n"); return 1; }
        size_t count = (argc >= 6) ? (size_t)std::stoul(argv[5]) : 1;
        return cmdRead((DWORD)pid, addr, argv[4], count);
    }
    if (cmd == "hex") {
        long pid = needPid(2); if (pid < 0) return 1;
        if (argc < 5) { std::fprintf(stderr, "error: hex <pid> <addr> <size>\n"); return 1; }
        uint64_t addr; if (!parseAddress(argv[3], addr)) { std::fprintf(stderr, "error: bad addr\n"); return 1; }
        size_t size = (size_t)std::stoul(argv[4]);
        return cmdHex((DWORD)pid, addr, size);
    }
    if (cmd == "dump") {
        long pid = needPid(2); if (pid < 0) return 1;
        if (argc < 6) { std::fprintf(stderr, "error: dump <pid> <addr> <size> <outfile>\n"); return 1; }
        uint64_t addr; if (!parseAddress(argv[3], addr)) { std::fprintf(stderr, "error: bad addr\n"); return 1; }
        size_t size = (size_t)std::stoul(argv[4]);
        return cmdDump((DWORD)pid, addr, size, argv[5]);
    }
    if (cmd == "dumpall") {
        long pid = needPid(2); if (pid < 0) return 1;
        if (argc < 4) { std::fprintf(stderr, "error: dumpall <pid> <outdir> [--max MB]\n"); return 1; }
        uint64_t maxBytes = 0;
        for (int i = 4; i + 1 < argc; ++i)
            if (std::string(argv[i]) == "--max") maxBytes = (uint64_t)std::stoull(argv[i + 1]) * 1024 * 1024;
        return cmdDumpAll((DWORD)pid, argv[3], maxBytes);
    }
    if (cmd == "scan") {
        long pid = needPid(2); if (pid < 0) return 1;
        if (argc < 5) { std::fprintf(stderr, "error: scan <pid> <type> <value>\n"); return 1; }
        return cmdScan((DWORD)pid, argv[3], argv[4]);
    }

    printUsage(argv[0]);
    return 1;
}
