#!/usr/bin/python3
import json
from subprocess import run
from os import listdir
from os.path import join

datasets_dir = "dist/json/datasets"
source_fonts_dir = "fonts/ttf"
subset_fonts_dir = "dist/assets/fonts"

def main():
    with open("src/json/fonts.json", 'r') as fontsJSON:
        fonts = json.load(fontsJSON)

    fonts = {font["family"]: font for font in fonts}
    charsets = {family: set() for family in fonts}
    stylesets = {family: set() for family in fonts}

    def validate_font_data(font_data):
        if "family" not in font_data:
            print("font family property missing.")
            return False

        if font_data["family"] not in charsets:
            raise ValueError(f'Unknown font family "{font_data["family"]}"')

        return True


    def update_charset(font_data, chrs):
        if isinstance(chrs, list):
            chrs = "".join(chrs)

        charsets[font_data["family"]].update(list(chrs))


    for filename in listdir(datasets_dir):
        with open(join(datasets_dir, filename), "r") as datasetJSON:
            dataset = json.load(datasetJSON)

        print("Processing dataset", dataset["name"])

        dataset_chars = set()

        gameHeading = dataset["metadata"]["gameHeading"]
        if "font" in gameHeading and validate_font_data(gameHeading["font"]):
            update_charset(gameHeading["font"], gameHeading["string"])

        if "fonts" in gameHeading:
            assert isinstance(gameHeading["fonts"], list)
            assert isinstance(gameHeading["string"], list)
            for font, string in zip(gameHeading["fonts"], gameHeading["string"]):
                update_charset(font, string)

        symbols = dataset["symbolsData"]["rows"]
        if not isinstance(symbols, list):
            symbols = symbols.values()

        template = False
        display_index = None
        if "template" in dataset["symbolsData"]:
            template = True
            try:
                display_index = dataset["symbolsData"]["template"].index("display")
            except ValueError:
                raise ValueError("display not in template.")

        for symbol in symbols:
            if template and isinstance(symbol, list):
                chars = "".join(symbol[display_index])
            else:
                chars = "".join(symbol["display"])

            dataset_chars.update(list(chars))


        for font_data in dataset["fonts"].values():
            if not validate_font_data(font_data):
                continue

            update_charset(font_data, dataset_chars)

            if "styleset" in font_data:
                vals = font_data["styleset"]
                if isinstance(vals, str):
                    vals = [vals]

                for val in vals:
                    stylesets[font_data["family"]].add(fonts[font_data["family"]]["styleset"][val])


    for family, font in fonts.items():
        if "sourceFilename" not in font:
            font["sourceFilename"] = family.replace(" ", "") + ".ttf"

        if "subsetFilename" not in font:
            font["subsetFilename"] = family.replace(" ", "") + ".woff2"

        chars_list = list(charsets[family])

        if len(chars_list) == 0:
            print(f'Skipping "{family}" with no characters.')
            continue

        chars_list.sort()
        chars = "".join(chars_list)
        hexs = ",".join([hex(ord(char))[2:] for char in chars_list])
        command = ["hb-subset"]

        print(f'Subsetting "{family}" with characters "{chars}"')

        if "variationSettings" in font:
            variations = []
            for key, value in font["variationSettings"].items():
                if " " in value:
                    continue
                variations.append(f"{key}={value}")

            command.append(f'--variations={",".join(variations)}')

        if len(stylesets[family]) > 0:
            command.append(f'--layout-features={",".join([f"ss{ss_id:02d}" for ss_id in stylesets[family]])}')

        command.extend([
            join(source_fonts_dir, font["sourceFilename"]),
            "-u", hexs,
            "-o", join(subset_fonts_dir, font["subsetFilename"])
        ])
        run(command)


if __name__ == "__main__":
    main()