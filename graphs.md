# Graphs.json
This file is a little bit of info about the formatting behind graphs.json

## General
graphs.json is an array of episodes.
Each of these epidsodes has certain groups and characters.
Each episode represents what an astute viewer would know at that point, not necesarily what the current state of things is.
Each episode is based on the information available by the end of the episode.
## Field description
### Character
Display name: The name to be displayed. This should be a shorter version of the name that listeners would know, such as "Jon" for "Jonathan Simms"
Full name: The full name of the character. For characters with many names, one is picked and others may be listed in the summary.
Id: unique number that identifys this character within the program. Never changes, and is based on internal use only (though generally is sequential by appearance).
Wiki link: Link to The Magnus Archives fandom wiki, only the extension (the thing after https://the-magnus-archives.fandom.com/wiki/)
 - *Default: empty string*
Image file: Link to an image to display.
 - *Default: empty string*
Type: What the character is. Usually human, sometimes inhuman/unknown or something else
 - *Default: Human*
Status: How the character is. Alive, dead, a secret third thing, unknown
 - *Default: Alive*
Mindset: How the character is feeling.
 - *Default: Unknown*
Summary: Short summary of what the character is in the story. Generally 1-3 sentences.
Alignment: What group the character is aligned with
 - *Default: None*
Relationships: details of relationships the character has
    Target id: The id of the character the relationship is with
    Type: What type of relationship it is (work, family, other, etc)
    Text: More specific, <7 word description of the relationship between the 2
    Feeling: How this character feels about the target
     - *Default: Unknown*
### Group
Display name: Same as above.
Full name: Same as above.
Id: Same as above.
Image file: Same as above.
Summary: Same as above.
Type: What kind of group it is (mundane, supernatural)
Relationship type: Type of relationship that connects all group members.
Alignment: Same as above.
Feeling: General feeling between characters in the group.
Member ids: List of character ids that are members of this group.
## Templates
### Character
```{
    "displayName": "",
    "fullName": "",
    "id": "",
    "wikiLink": "",
    "imageFile": "",
    "type": "",
    "status": "",
    "mindset": "",
    "summary": "",
    "alignment": "",
    "relationships": [
        {
            "targetId": "",
            "type": "",
            "text": "",
            "feeling": ""
        }
    ]
}```
### Group
```{
    "displayName": "",
    "fullName": "",
    "groupId": "",
    "wikiLink": "",
    "imageFile": "",
    "summary": "",
    "type": "",
    "relationType": "",
    "feeling": "",
    "alignment": "",
    "memberIds": [
        ""
    ]
}```
