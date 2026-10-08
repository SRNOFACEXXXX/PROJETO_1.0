# mem-inspector

Inspetor de memória de processo para Windows — ferramenta de **depuração**. Anexa
a um processo que **você controla** (ex.: o seu próprio app rodando) e lê a
memória viva dele: enumera regiões, lê valores tipados num endereço, faz
hex-dump de um intervalo, procura um valor para localizar uma variável, ou
despeja as regiões commitadas em disco para análise offline.

Usa apenas APIs documentadas do Win32 (`OpenProcess` + `ReadProcessMemory` +
`VirtualQueryEx`) e **nunca escreve** no processo alvo. Use somente em processos
que você está autorizado a inspecionar (os seus).

## Compilar

Precisa ser compilado no Windows (ou cross-compilado com MinGW-w64). Compile
como **x64** para inspecionar alvos de 64 bits.

### Opção A — MSVC (Developer Command Prompt → "x64 Native Tools")
```
cl /EHsc /O2 /std:c++17 main.cpp /Fe:mem-inspector.exe
```

### Opção B — CMake (MSVC ou MinGW)
```
cmake -S . -B build -A x64
cmake --build build --config Release
```
O executável sai em `build\Release\mem-inspector.exe` (MSVC) ou `build\mem-inspector.exe` (MinGW).

### Opção C — MinGW-w64 direto
```
x86_64-w64-mingw32-g++ -O2 -std=c++17 main.cpp -o mem-inspector.exe -lpsapi
```

## Usar

```
mem-inspector list                                 # lista processos (nome + PID)
mem-inspector regions <pid> [--all]                # regiões de memória commitadas
mem-inspector read <pid> <addr> <type> [count]     # lê valor(es) tipado(s)
mem-inspector hex  <pid> <addr> <size>             # hex-dump de <size> bytes
mem-inspector dump <pid> <addr> <size> <arquivo>   # despeja bytes crus em arquivo
mem-inspector dumpall <pid> <dir> [--max MB]       # despeja todas as regiões legíveis
mem-inspector scan <pid> <type> <valor>            # procura um valor (acha variáveis)
```

- **Endereço**: hex (`0x7ff6000012a0`) ou decimal.
- **Tipos**: `u8 i8 u16 i16 u32 i32 u64 i64 f32 f64 str`.

### Fluxo típico de debug (achar e inspecionar uma variável)
```
mem-inspector list                       # pega o PID do seu app
mem-inspector scan 4242 i32 1337         # acha onde o inteiro 1337 está
mem-inspector read 4242 0x1a2b3c4d i32   # lê o valor naquele endereço
mem-inspector hex  4242 0x1a2b3c4d 64    # vê os bytes ao redor (structs)
```

## Notas

- **Privilégios**: alguns alvos exigem rodar o `mem-inspector` como
  Administrador. Processos protegidos (PPL/antimalware) e serviços do sistema
  não são acessíveis — e nem é a proposta desta ferramenta.
- **Bitness**: um build 32-bit não abre um alvo 64-bit. Use x64.
- **"Descompactado"**: `regions`/`dumpall` operam sobre memória **commitada**
  (`MEM_COMMIT`), que é o estado em claro/descompactado do processo em runtime —
  é o que você quer ao depurar structs e estado vivo.
- **Somente leitura**: a ferramenta não altera o processo. Para escrever em
  memória (ex.: mudar uma variável em runtime) seria preciso `WriteProcessMemory`,
  deliberadamente **não** incluído.
