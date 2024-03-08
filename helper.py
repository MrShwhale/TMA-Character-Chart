# This file is used to replace character ids
# At the moment, it finds all numbers larger than 112 and increments them
# This frees up the id 113 to be used, which was what it needed to do
# Be careful later if you get into triple digit episode numbers
import re

s = ""

def repl(match): 
    num = int(match.group(0))
    if num >= 113:
        return str(num + 1)
    return str(num)

with open("./graphs.json", "r") as f:
    pat = re.compile(r"\d+")
    for l in f:
        s += pat.sub(repl, l)

with open("./graphs_fixed.json", "w") as f:
    f.write(s)
