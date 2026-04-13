find /usr/ | grep \/cyg.*dll$ | xargs -I ARG sh -c "echo ARG; ldd ARG" > build-check-deps.txt

find /usr/ | grep \/.*exe$ | xargs -I ARG sh -c "echo ARG; ldd ARG" >> build-check-deps.txt
