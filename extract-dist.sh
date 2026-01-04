pushd dist
cp -arf ../dist-init/gcc-libs-15.2.0-2-x86_64-stage0.pkg.tar.zst gcc-libs-15.2.0-2-x86_64.pkg.tar.zst
rm -rf ../tmp
mkdir ../tmp
echo "Start extract"
find . -name "*.pkg.tar.zst" | xargs -I ARG tar xf ARG -C ../tmp
echo "Finished extract"
popd

LIBRARY_PATH=/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../../x86_64-pc-cygwin/lib/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../:/usr/lib/

LIBRARY_PATH=/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../../x86_64-pc-cygwin/lib/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../:/usr/lib/


work:
COMPILER_PATH=/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../../x86_64-pc-cygwin/bin/
COMPILER_PATH=/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/:/usr/lib/gcc/x86_64-pc-cygwin/:/usr/lib/gcc/x86_64-pc-cygwin/15.2.0/../../../../x86_64-pc-cygwin/bin/