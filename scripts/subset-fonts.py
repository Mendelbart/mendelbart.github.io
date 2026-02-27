#!/usr/bin/python3
import json
from subprocess import run
from os import listdir
from os.path import join
import re
import warnings

datasets_dir = "dist/json/datasets"
source_fonts_dir = "fonts/scripts"
subset_fonts_dir = "dist/assets/fonts/scripts"

def get_family(font_data, dataset_fonts, default):
    family = default
    if "key" in font_data:
        family = dataset_fonts[font_data["key"]]["family"]

    return family


def contains_subsettable_fonts(fonts, subsettable_fonts):
    for font_data in fonts.values():
        if not "family" in font_data:
            raise ValueError("No family specified in font entry.")

        if font_data["family"] in subsettable_fonts:
            return True

    return False


def get_default_font(fonts):
    for key, font_data in fonts.items():
        if "default" in font_data and font_data["default"]:
            return font_data["family"]

    if len(fonts) == 1:
        return list(fonts.values())[0]["family"]
    else:
        raise ValueError("No default font specified.")


def main():
    with open("src/json/fonts.json", 'r') as fontsJSON:
        fonts = json.load(fontsJSON)

    fonts = {font["family"]: font for font in fonts}
    charsets = {family: set() for family in fonts}
    stylesets = {family: set() for family in fonts}


    def update_charset(family, chrs):
        if family not in fonts:
            warnings.warn(f"Family '{family}' not font in fonts.json.")
            return

        if isinstance(chrs, list):
            chrs = "".join(chrs)

        charsets[family].update(list(chrs))


    for filename in listdir(datasets_dir):
        with open(join(datasets_dir, filename), "r") as datasetJSON:
            dataset = json.load(datasetJSON)

        print("Processing dataset", dataset["name"])

        if not contains_subsettable_fonts(dataset["fonts"], fonts):
            continue

        default_font = get_default_font(dataset["fonts"])
        dataset_chars = set()

        game_heading = dataset["metadata"]["gameHeading"]
        game_heading_font = default_font
        if "font" in game_heading:
            game_heading_font = get_family(game_heading["font"], dataset["fonts"], default_font)

        update_charset(game_heading_font, game_heading["string"])


        items = dataset["items"]["data"]
        if not isinstance(items, list):
            items = items.values()

        for item in items:
            dataset_chars.update(list("".join(item[0])))


        for font_data in dataset["fonts"].values():
            family = font_data["family"]
            if family not in fonts:
                continue

            update_charset(family, dataset_chars)

            if "styleset" in font_data:
                vals = re.split(r",\s*", font_data["styleset"])

                for val in vals:
                    stylesets[family].add(fonts[family]["styleset"][val])


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
