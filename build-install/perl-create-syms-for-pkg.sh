# Create an array
perl_pkgs=("Clone" "TermReadKey" "Locale-Gettext" "Text-CharWidth" "Unicode-LineBreak" "XML-Parser" "YAML-Syck" "HTML-Parser")

# Loop through all elements in the array
for item in "${perl_pkgs[@]}"
do
    rm -f perl-${item}-finish.sh
    rm -f perl-${item}-prepare.sh
    ln -s -T perl-finish-pkg.sh perl-${item}-finish.sh
    ln -s -T perl-prepare-pkg.sh perl-${item}-prepare.sh
done
