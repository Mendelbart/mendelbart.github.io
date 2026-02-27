#!/usr/bin/python3
from subprocess import run
import re

def main():
    with open("src/scss/fontawesome.scss", "r") as f:
        css = f.read()

    codes = []
    for m in re.finditer(r'--fa:\s*"\\(.*?)"', css):
        codes.append(m.group(1))

    command = [
        "hb-subset", "fonts/icons/fa-solid-900.otf",
        "-u", ",".join(codes),
        "-o", "dist/assets/fonts/icons/fa-solid-900.woff2"
    ]
    print(command)
    run(command)


if __name__ == "__main__":
    main()
