rm -rf ${srcdir}/dest
mkdir -p ${srcdir}/dest
tar xf ${srcdir}/../base/gcc-15.2.0-2-x86_64-stage0.pkg.tar.zst -C ${srcdir}/dest
tar xf ${srcdir}/../base/gcc-libs-15.2.0-2-x86_64-stage0.pkg.tar.zst -C ${srcdir}/dest

pushd ${srcdir}/dest
rm .BUILDINFO .MTREE .PKGINFO
popd

cp -arf ${DESTDIR}/* ${srcdir}/dest/
