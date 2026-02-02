import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import {
  spawnProcessAsync,
  spawnProcessAsyncCapture,
  removeDirectory,
  archiveFull,
} from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function install_mingw(MINGW_PACKAGE_PREFIX) {
  const packages_extra = [
    `${MINGW_PACKAGE_PREFIX}-cmake`,
    `${MINGW_PACKAGE_PREFIX}-gdb`,
    `${MINGW_PACKAGE_PREFIX}-gdb-multiarch`,
    `${MINGW_PACKAGE_PREFIX}-libuv`,
    `${MINGW_PACKAGE_PREFIX}-spirv-tools`,
    `${MINGW_PACKAGE_PREFIX}-lld`,
    `${MINGW_PACKAGE_PREFIX}-mosquitto`,
  ];
  const packages_gegl = [
    `${MINGW_PACKAGE_PREFIX}-asciidoc`,
    `${MINGW_PACKAGE_PREFIX}-cc`,
    `${MINGW_PACKAGE_PREFIX}-gobject-introspection`,
    `${MINGW_PACKAGE_PREFIX}-gtk-doc`,
    `${MINGW_PACKAGE_PREFIX}-luajit`,
    `${MINGW_PACKAGE_PREFIX}-pkgconf`,
    `${MINGW_PACKAGE_PREFIX}-ruby`,
    `${MINGW_PACKAGE_PREFIX}-vala`,
    `${MINGW_PACKAGE_PREFIX}-meson`,
    `${MINGW_PACKAGE_PREFIX}-openmp`,

    // depends
    // `${MINGW_PACKAGE_PREFIX}-babl`,
    `${MINGW_PACKAGE_PREFIX}-cairo`,
    `${MINGW_PACKAGE_PREFIX}-exiv2`,
    `${MINGW_PACKAGE_PREFIX}-ffmpeg`,
    `${MINGW_PACKAGE_PREFIX}-gexiv2`,
    `${MINGW_PACKAGE_PREFIX}-gcc-libs`,
    `${MINGW_PACKAGE_PREFIX}-gdk-pixbuf2`,
    `${MINGW_PACKAGE_PREFIX}-gettext`,
    `${MINGW_PACKAGE_PREFIX}-glib2`,
    `${MINGW_PACKAGE_PREFIX}-jasper`,
    `${MINGW_PACKAGE_PREFIX}-json-glib`,
    `${MINGW_PACKAGE_PREFIX}-libjpeg`,
    `${MINGW_PACKAGE_PREFIX}-libpng`,
    `${MINGW_PACKAGE_PREFIX}-libraw`,
    `${MINGW_PACKAGE_PREFIX}-librsvg`,
    `${MINGW_PACKAGE_PREFIX}-libspiro`,
    `${MINGW_PACKAGE_PREFIX}-libwebp`,
    `${MINGW_PACKAGE_PREFIX}-lcms2`,
    `${MINGW_PACKAGE_PREFIX}-lensfun`,
    `${MINGW_PACKAGE_PREFIX}-maxflow`,
    `${MINGW_PACKAGE_PREFIX}-openexr`,
    `${MINGW_PACKAGE_PREFIX}-pango`,
    `${MINGW_PACKAGE_PREFIX}-SDL2`,
    `${MINGW_PACKAGE_PREFIX}-suitesparse`,
  ];

  const packages_mesa = [
    // make depends
    `${MINGW_PACKAGE_PREFIX}-cc`,
    `${MINGW_PACKAGE_PREFIX}-glslang`,
    `${MINGW_PACKAGE_PREFIX}-python-mako`,
    `${MINGW_PACKAGE_PREFIX}-python-pip`,
    `${MINGW_PACKAGE_PREFIX}-meson`,
    `${MINGW_PACKAGE_PREFIX}-pkgconf`,
    `${MINGW_PACKAGE_PREFIX}-libelf`,

    // depends
    `${MINGW_PACKAGE_PREFIX}-llvm`,
    `${MINGW_PACKAGE_PREFIX}-clang`,
    `${MINGW_PACKAGE_PREFIX}-libclc`,
    `${MINGW_PACKAGE_PREFIX}-libva`,
    `${MINGW_PACKAGE_PREFIX}-spirv-tools`,
    `${MINGW_PACKAGE_PREFIX}-spirv-llvm-translator`,
    `${MINGW_PACKAGE_PREFIX}-vulkan-loader`,
    `${MINGW_PACKAGE_PREFIX}-zlib`,
    `${MINGW_PACKAGE_PREFIX}-zstd`,

    // optdepends
    `${MINGW_PACKAGE_PREFIX}-opengl-man-pages`,
    `${MINGW_PACKAGE_PREFIX}-vulkan-validation-layers`,
  ];

  const packages_tss = [
    `${MINGW_PACKAGE_PREFIX}-toolchain`,
    `${MINGW_PACKAGE_PREFIX}-pkgconf`,
    `${MINGW_PACKAGE_PREFIX}-gdb`,
    `${MINGW_PACKAGE_PREFIX}-gdb-multiarch`,
    `${MINGW_PACKAGE_PREFIX}-mosquitto`,
    `${MINGW_PACKAGE_PREFIX}-clang`,
    `${MINGW_PACKAGE_PREFIX}-lld`,
  ];

  const packages_scade = [
    `${MINGW_PACKAGE_PREFIX}-toolchain`,
    `${MINGW_PACKAGE_PREFIX}-pkgconf`,
    `${MINGW_PACKAGE_PREFIX}-gdb`,
    `${MINGW_PACKAGE_PREFIX}-gdb-multiarch`,
    `${MINGW_PACKAGE_PREFIX}-clang`,
    `${MINGW_PACKAGE_PREFIX}-lld`,
    `${MINGW_PACKAGE_PREFIX}-mesa`,
    `${MINGW_PACKAGE_PREFIX}-mosquitto`,
  ];

  const packages_qemu = [
    `${MINGW_PACKAGE_PREFIX}-binutils`,
    `${MINGW_PACKAGE_PREFIX}-capstone`,
    `${MINGW_PACKAGE_PREFIX}-ccache`,
    `${MINGW_PACKAGE_PREFIX}-cjson`,
    `${MINGW_PACKAGE_PREFIX}-curl`,
    `${MINGW_PACKAGE_PREFIX}-cyrus-sasl`,
    `${MINGW_PACKAGE_PREFIX}-dtc`,
    `${MINGW_PACKAGE_PREFIX}-gcc`,
    `${MINGW_PACKAGE_PREFIX}-glib2`,
    `${MINGW_PACKAGE_PREFIX}-gnutls`,
    `${MINGW_PACKAGE_PREFIX}-gtk3`,
    `${MINGW_PACKAGE_PREFIX}-jemalloc`,
    `${MINGW_PACKAGE_PREFIX}-libcbor`,
    `${MINGW_PACKAGE_PREFIX}-libgcrypt`,
    `${MINGW_PACKAGE_PREFIX}-libjpeg-turbo`,
    `${MINGW_PACKAGE_PREFIX}-libnfs`,
    `${MINGW_PACKAGE_PREFIX}-libpng`,
    `${MINGW_PACKAGE_PREFIX}-libssh`,
    `${MINGW_PACKAGE_PREFIX}-libtasn1`,
    `${MINGW_PACKAGE_PREFIX}-libusb`,
    `${MINGW_PACKAGE_PREFIX}-libxml2`,
    `${MINGW_PACKAGE_PREFIX}-lzo2`,
    `${MINGW_PACKAGE_PREFIX}-nettle`,
    `${MINGW_PACKAGE_PREFIX}-ninja`,
    `${MINGW_PACKAGE_PREFIX}-pixman`,
    `${MINGW_PACKAGE_PREFIX}-pkgconf`,
    `${MINGW_PACKAGE_PREFIX}-python-sphinx`,
    `${MINGW_PACKAGE_PREFIX}-python`,
    `${MINGW_PACKAGE_PREFIX}-SDL2_image`,
    `${MINGW_PACKAGE_PREFIX}-SDL2`,
    `${MINGW_PACKAGE_PREFIX}-snappy`,
    `${MINGW_PACKAGE_PREFIX}-spice-gtk`,
    `${MINGW_PACKAGE_PREFIX}-spice`,
    `${MINGW_PACKAGE_PREFIX}-toolchain`,
    `${MINGW_PACKAGE_PREFIX}-usbredir`,
    `${MINGW_PACKAGE_PREFIX}-zstd`,
  ];

  const packages = Array.from(
    new Set(
      [].concat(
        packages_extra,
        packages_gegl,
        packages_mesa,
        packages_tss,
        packages_scade,
        packages_qemu,
      ),
    ),
  );

  const ci_tools_root = "D:/CI-Tools/msys64-stage3";
  const msys_root = path.join(ci_tools_root, "msys64");
  const pkg_root = __dirname;

  const msys_txt_path = path.join(pkg_root, "install-mingw-for-stage3.txt");
  await fs.writeFile(msys_txt_path, packages.join("\n"), "utf-8");

  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      `pacman -S --noconfirm --needed $(cat install-mingw-for-stage3.txt)`,
    ],
    {
      cwd: pkg_root,
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
}

install_mingw("mingw-w64-x86_64");
