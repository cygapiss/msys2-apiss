# Create an array
perl_pkgs=(
    "perl-Clone"
    "perl-TermReadKey"
    "perl-Locale-Gettext"
    "perl-Text-CharWidth"
    "perl-Unicode-LineBreak"
    "perl-XML-Parser"
    "perl-YAML-Syck"
    "perl-HTML-Parser"
)

# Loop through all elements in the array
for item in "${perl_pkgs[@]}"
do
    rm -f ${item}-finish.sh
    rm -f ${item}-prepare.sh
    ln -s -T perl-finish-pkg.sh ${item}-finish.sh
    ln -s -T perl-prepare-pkg.sh ${item}-prepare.sh
done
