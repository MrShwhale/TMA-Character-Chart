# This file is used to replace character ids
# Be careful later if you get into episode numbers greater than the id you are trying to replace

TO_CLOSE = 221
import re

s = ""

def repl(match): 
    num = int(match.group(0))
    if num > TO_CLOSE:
        return str(num - 1)
    if num == TO_CLOSE:
        return "999"
    return str(num)

with open("./graphs.json", "r") as f:
    pat = re.compile(r"\d+")
    for l in f:
        s += pat.sub(repl, l)

with open("./graphs_fixed.json", "w") as f:
    f.write(s)
