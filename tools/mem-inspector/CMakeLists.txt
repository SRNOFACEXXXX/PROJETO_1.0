cmake_minimum_required(VERSION 3.15)
project(mem_inspector CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(mem-inspector main.cpp)

if(MSVC)
    target_compile_options(mem-inspector PRIVATE /O2 /EHsc /W4)
else()
    target_compile_options(mem-inspector PRIVATE -O2 -Wall -Wextra)
    # MinGW needs psapi for process APIs
    target_link_libraries(mem-inspector PRIVATE psapi)
endif()
