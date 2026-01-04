# sh ./build-base-devel.sh >out.txt 2>&1
# Clean dll and exe: '.+'
# sh ./build-all.sh >build-all.txt 2>&1

# MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
# MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
# MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gnupg >gnupg.txt 2>&1
# MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled sh build-single.sh gnupg >gnupg.txt 2>&1
# MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
# MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
# MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R
# repack with force
# MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R -f

pacman -Syu --noconfirm --needed
pacman -Syu --noconfirm --needed
pacman -S ca-certificates --noconfirm --needed
update-ca-trust

# pacman -Qq >msys.txt
# updpkgsums
# Do not extract source
# makepkg  -e -f
# makepkg --nobuild --cleanbuild
# makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck
# makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck --skippgpcheck

pacman -Sl msys  >msys.txt

gpg --recv-keys 6570EA01146F7354
gpg --recv-keys 7FD9FCCB000BEEEE
gpg --recv-keys BB5869F064EA74AB
gpg --recv-keys 738409F520DF9190
gpg --recv-keys C1D15611B2E4720B
gpg --recv-keys CE9D6843AABACC90
gpg --recv-keys CC2AF4472167BE03
gpg --recv-keys EF8FE99528B52FFD
gpg --recv-keys 3164705B1DA31D4C
gpg --recv-keys 8FE99503132D7742
gpg --recv-keys 96262ACFFBD3AEC6
gpg --recv-keys F3599FF828C67298
gpg --recv-keys 72D23FBAC99D4E75
gpg --recv-keys D3657D24D058434C
gpg --recv-keys B972BF3EA4AE57A3
gpg --recv-keys F5BE8B267C6A406D
gpg --recv-keys F28C3C8DA33C03BE
gpg --recv-keys F52E98007594C21D
gpg --recv-keys A7A16B4A2527436A
gpg --recv-keys 783FCD8E58BCAFBA
gpg --recv-keys 5339A2BE82E07DEC
gpg --recv-keys E98E9B2D19C6C8BD
gpg --recv-keys ED97E90E62AA7E34
gpg --recv-keys D46C5610D06E7001
gpg --recv-keys 5831D11A0D4DB02A
gpg --recv-keys 62394C698C2739FA
gpg --recv-keys D5BF9FEB0313653A
gpg --recv-keys 670322244C807502
gpg --recv-keys 65C26E471F45B123
gpg --recv-keys 99DC5E4DB05F6BE2
gpg --recv-keys 46502EF796917195
gpg --recv-keys DF597815937EC0D2
gpg --recv-keys 79FFD94BFCE230B1
gpg --recv-keys F0DC8E00B28C5995
gpg --recv-keys 528897B826403ADA
gpg --recv-keys 13FCEF89DD9E3C4F
gpg --recv-keys F7D5C9BF765C61E3
gpg --recv-keys 514BBE2EB8E1961F
gpg --recv-keys 022166C0FF3C84E3
gpg --recv-keys 3602B07F55D0C732
gpg --recv-keys 71C636695B147849
gpg --recv-keys 0DDCAA3278D5264E
gpg --recv-keys DF6FD971306037D9
gpg --recv-keys AC8E115BF73E2D8D47FA9908E98E9B2D19C6C8BD
gpg --recv-keys 9766E084FB0F43D8
gpg --recv-keys 021DE40BFB63B406
gpg --recv-keys E9CBDFC0ABC0A854
gpg --recv-keys 8533F94B6379E538
gpg --recv-keys DDBC579DAB37FBA9
gpg --recv-keys ACF8146CAE8CBBC4
gpg --recv-keys 0716748A30D155AD
gpg --recv-keys 93C08C88471097CD
gpg --recv-keys 2AF9977BDA5E41B1
gpg --recv-keys 216094DFD0CB81EF
gpg --recv-keys B86086848EF8686D
gpg --recv-keys 3D6A49E4C4E0B673
gpg --recv-keys 393587D97D86500B
gpg --recv-keys 5CC908FDB71E12C2
gpg --recv-keys B7C20D079491EA63
gpg --recv-keys 2A714497E37363AE
gpg --recv-keys C040B508D63D2B36
gpg --recv-keys 71112AB16CB33B3A
gpg --recv-keys 9A077911BB7DC320
gpg --recv-keys 03D5DF8CFDD3E8E7
gpg --recv-keys 2A3F414E736060BA
gpg --recv-keys C24E631BABB1FE70
gpg --recv-keys A11E01CD0E05D956
gpg --recv-keys BEE3E3B4D2F06546
gpg --recv-keys 44F2485E45D59042
gpg --recv-keys 495143D05D0712D1
gpg --recv-keys 92EDB04BFF325CF3
gpg --recv-keys 2BDB4A0944FA00B1
gpg --recv-keys 51722B08FE4745A2
gpg --recv-keys 7A75A648B3F9220C
gpg --recv-keys 5CC908FDB71E12C2
gpg --recv-keys D605848ED7E69871
gpg --recv-keys E78DAE0F3115E06B
gpg --recv-keys 85AB96E6FA1BE5FE
gpg --recv-keys 147C39FF9634B72C
gpg --recv-keys 64FF90AAE8C70AF9
gpg --recv-keys 00CCB587DDBEF0E1
gpg --recv-keys ADEF768480316BDA

gpg --recv-keys E1A701D4C9DE75B5

gpg --recv-keys DEACCAAEDB78137A