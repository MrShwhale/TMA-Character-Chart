// Import libraries
import cytoscape from 'cytoscape';
import popper from 'cytoscape-popper';
import fs from 'fs';

// Import data
import rawGraphSteps from './graphs.json';
import rawPositions from './positions.json'

cytoscape.use(popper);

// Season descriptors
let seasonDescriptors = ["Something's Off", "It Could Be Anyone", "Knowledge is Power", "A New Low", "The End"]
var changeCount = {}

// Only add things that are changed in newEntries, don't touch anything else
function accumulateGraph(oldGraph, newEntries) {
    // This makes a 1-deep copy of oldGraph, except for the relationships array, which is itself a 1-deep copy
    // This makes the relationships array empty if none is found, replace this
    let combined = {
        characters: oldGraph.characters.map(a => ({...a, relationships: a.hasOwnProperty("relationships") ? a.relationships.map(b => ({...b})) : []})), 
        groups: oldGraph.groups.map(c => ({...c}))
    };

    // Make sure there is a characters list
    if (newEntries.characters != undefined) {
        // Manage the characters
        for (const character of newEntries.characters) {
            // Increase the number of times this has been changed
            if (changeCount[character.id] == undefined) {
                changeCount[character.id] = 1
            }
            else {
                changeCount[character.id] += 1
            }

            // Since ids are sequential, any id that can be used to index oldGraph must be a replacement
            let intId = parseInt(character.id);
            if (intId < combined.characters.length) {
                // Replace as needed
                for (const [key, value] of Object.entries(character)) {
                    // Handle replacing relationships
                    if (key == "relationships") {
                        for (const relationship of value) {
                            let index = -1;
                            // Search the list of relationships
                            for (let i = 0; i < combined.characters[intId].relationships.length; i++) {
                                if (combined.characters[intId].relationships[i].targetId == relationship.targetId) {
                                    index = i;
                                    //break;
                                }
                            }

                            relationship["updated"] = selectedGraph;

                            if (index >= 0) {
                                // If this is an existing relationship,
                                // Replace it
                                combined.characters[intId].relationships[index] = {...combined.characters[intId].relationships[index], ...relationship};
                            }
                            else {
                                // If this is a new relationship, just add it
                                combined.characters[intId].relationships.push(relationship);
                            }
                        }
                    }
                    else {
                        combined.characters[intId][key] = value;
                    }
                }
            }
            else {
                // Concatenate
                combined.characters.push(character);
            }
        }
    }

    // Manage the groups
    if (newEntries.groups) {
        for (const group of newEntries.groups) {
            // Since ids are sequential, any id that can be used to index oldGraph must be a replacement
            let groupId = parseInt(group.groupId);
            if (groupId < combined.groups.length) {
                // Replace as needed
                // This means that members will have to be replaced all at once: every member must be listed every time
                // BUG group relationships might not exist at all?
                for (const [key, value] of Object.entries(group)) {
                    combined.groups[groupId][key] = value;
                }
            }
            else {
                // Concatenate
                combined.groups.push(group);
            }
        }
    }

    return combined;
}

let graphSteps = [{characters: rawGraphSteps[0].episodeCharacters, groups: rawGraphSteps[0].episodeGroups}];

var selectedGraph;
console.log("Accumulating graph steps...")
// Accumulate the graph
for (let i = 1; i < rawGraphSteps.length; i++) {
    // Theoretically this passes by reference
    selectedGraph = i;
    graphSteps.push(accumulateGraph(graphSteps[i-1], {characters: rawGraphSteps[i].episodeCharacters, groups: rawGraphSteps[i].episodeGroups}));
}

// Add group support
function formatGraph(graphList) {
    console.log("Formatting graph list...");
    // Create the nodes
    let formattedGraph = graphList.map((element) => {
        // Keep track of the inverse of relations that already exist
        let complementaryRelations = {};
        let completedRelations = {};
        let entries = [];

        for (const entry of element.characters) {
            // If this entry has no relationships, skip it
            if (!entry.hasOwnProperty('relationships') || entry.relationships.length == 0) {
                entries.push({data: entry});
                continue;
            }

            for (const relation of entry.relationships)
            {
                // The id of this entry, should it go through
                let potentialId = `${entry.id}-${relation.targetId}`;
                let inverseId = `${relation.targetId}-${entry.id}`;


                // If there is already a version of this completed, mark it bidirectional
                if (complementaryRelations.hasOwnProperty(potentialId) && complementaryRelations[potentialId] == relation.type) {
                    completedRelations[inverseId].data.secondText = relation.text;
                    completedRelations[inverseId].data.directed = false;
                    continue;
                }

                // Add the inverse to the list of inverse relations
                complementaryRelations[inverseId] = relation.type;
                completedRelations[potentialId] = 
                {
                    data: {
                        id: potentialId,
                        source: entry.id,
                        target: relation.targetId,
                        type: relation.type,
                        text: relation.text,
                        feeling: relation.feeling,
                        updated: relation.updated,
                        directed: true,
                    }
                }
            }

            entries.push({data: entry});
        }

        let groups = [];

        // Handle groups
        for (const group of element.groups) {
            // Make a parent node
            let cyId = `g${group.groupId}`;
            groups.push({
                data: {
                    id: cyId,
                    ...group
                }
            });

            // Attach the child nodes to it
            for (const child of group.memberIds) {
                let intMemberId = parseInt(child);
                entries[intMemberId].data.parent = cyId;
            }

            // If this entry has no relationships, skip it
            if (group.hasOwnProperty('relationships') && group.relationships.length > 0) {
                for (const relation of group.relationships) {
                    // The id of this entry, should it go through
                    let potentialId = `${cyId}-${relation.targetId}`;
                    let inverseId = `${relation.targetId}-${cyId}`;

                    // If there is already a version of this completed, mark it bidirectional
                    if (complementaryRelations.hasOwnProperty(potentialId) && complementaryRelations[potentialId] == relation.type) {
                        completedRelations[inverseId].data.directed = false;
                        continue;
                    }

                    // Add the inverse to the list of inverse relations
                    complementaryRelations[inverseId] = relation.type;
                    completedRelations[potentialId] = {
                        data: {
                            id: potentialId,
                            source: cyId,
                            target: relation.targetId,
                            type: relation.type,
                            text: relation.text,
                            feeling: relation.feeling,
                            updated: relation.updated,
                            directed: true,
                        }
                    }
                }
            }
        }

        return {elements: entries.concat(Object.values(completedRelations)).concat(groups)};
    });
    return formattedGraph;
}

var graphs = formatGraph(graphSteps);

function setUpGraph(graphIndex) {
    let data = graphs[graphIndex];

    let graphStyling = [
        {
            selector: 'node',
            style: {
                backgroundColor: '#9CAFB7',
            },
        },
        {
            selector: 'node[displayName]',
            // Maybe only do first letter of name centered on the node, put the rest in the popup
            style: {
                shape: 'ellipse',
                color: '#0A0A0A',
                fontFamily: "Noto Sans",
                fontWeight: 700,
                label: 'data(displayName.0)',
                "text-halign": 'center',
                "text-valign": 'center',
            },
        },
        {
            selector: 'node[alignment = \'Magnus Institute\']',
            style: {
                // Green colorpicked from TMA logo
                backgroundColor: "#157535",
            },
        },
        {
            selector : 'edge',
            style: {
                width: '5',
            }
        },
        {
            selector: 'edge[?directed]',
            style: {
                targetArrowShape: 'triangle',
                curveStyle: 'straight',
            },
        },
        {
            selector: 'edge[^directed]',
            style: {
                curveStyle: 'straight',
            },
        },
        // Relationship type coloring
        // Probably doable better
        {
            selector: 'edge[type = \'Acquaintances\']',
            style: {
                targetArrowColor: '#FFDE59',
                lineColor: '#FFDE59',
            },
        },
        {
            selector: 'edge[type = \'Friends\']',
            style: {
                targetArrowColor: '#C1FF72',
                lineColor: '#C1FF72',
            },
        },
        {
            selector: 'edge[type = \'Work\']',
            style: {
                targetArrowColor: '#0097B2',
                lineColor: '#0097B2',
            },
        },
        {
            selector: 'edge[type = \'Family\']',
            style: {
                targetArrowColor: '#8C52FF',
                lineColor: '#8C52FF',
            },
        },
        {
            selector: 'edge[type = \'Other\']',
            style: {
                targetArrowColor: '#D9D9D9',
                lineColor: '#D9D9D9',
            },
        },
        {
            selector: 'edge[type = \'Enemy\']',
            style: {
                targetArrowColor: '#FF5757',
                lineColor: '#FF5757',
            },
        },
        {
            selector: 'edge[type = \'Is\']',
            style: {
                targetArrowColor: '#F4AFFF',
                lineColor: '#F4AFFF',
            },
        },
        {
            selector: ':parent',
            style: {
                shape: 'round-rectangle',
                borderStyle: 'dashed',
                borderColor: '#F0F0F0',
                borderWidth: '3',
                backgroundOpacity: '0',
            },
        },
    ];

    let presetLayout = {
        name: "preset",
        // positions: rawPositions[selectedGraph]
        // Debug thing
        positions: rawPositions[selectedGraph] ? rawPositions[selectedGraph] : rawPositions[selectedGraph - 1]
    }

    // Cola is slow, so precompute and then load from an existing file
    let graph = {
        container: document.getElementById('cy'),
        style: graphStyling,
        layout: presetLayout,
        minZoom: 0.3,
        maxZoom: 3,
        ...data,
   };

    cyGraph = cytoscape(graph);

    // Double click for sanity reasons
    cyGraph.elements().unbind("select");
    cyGraph.elements().bind("select", (event) => {
        console.log(event.target._private.data);
        return;

        // Prevent parents from double-displaying a page
        if (event.runOnce) {
            return;
        }

        event.target.popperRefObj = event.target.popper({
            content: () => {
                let content = document.createElement("html");

                let eventData = event.target._private.data;

                // If this is a relationship element
                // BUG this is broken with groups, should probably handle them totally differently
                if (event.target.id().indexOf('-') >= 0) {
                    // No clue how I'm going to do this
                    // But when you do, keep in mind that the default value is "Unknown"
                    // let feeling = data;

                    console.log([parseInt(eventData.target)]);

                    let source = data.elements[parseInt(eventData.source)].data.displayName;
                    let target = data.elements[parseInt(eventData.target)].data.displayName;

                    let relationshipText = eventData.text;
                    if (relationshipText.indexOf('%') >= 0) {
                        relationshipText = relationshipText.replace("%s", target);
                    }
                    else {
                        relationshipText += " " + target;
                    }

                    let secondLine = "";
                    if (!eventData.directed) {
                        let secondRelationshipText = eventData.secondText;
                        if (secondRelationshipText.indexOf('%') >= 0) {
                            secondRelationshipText = secondRelationshipText.replace("%s", source);
                        }
                        else {
                            secondRelationshipText += " " + source;
                        }
                        secondLine = `<hr><p>${target}: ${secondRelationshipText}</p>`;
                    }

                    content.innerHTML = 
                    `<div class="popper-relationship-container">
                        <p>${source}: ${relationshipText}</p>
                        ${secondLine}
                    </div>`;
                }
                // Otherwise it is a normal one
                else {
                    console.log(eventData);
                    // BUG this doesn't work for group elements
                    let displayName = eventData.displayName;
                    let fullName = eventData.fullName;
                    // Setting defaults
                    let type = eventData.type ? eventData.type : "Human";
                    let status = eventData.status ? eventData.status : "Alive";
                    let summary = eventData.summary;
                    let nameLine = `<p class="displayName">${displayName}</p>`;
                    if (eventData.wikiLink) {
                        nameLine = `<a href="https://the-magnus-archives.fandom.com/wiki/${eventData.wikiLink}">` + nameLine + "</a>"
                    }

                    let fullNameLine = "";
                    if (eventData.fullName) {
                        fullNameLine = `<p class="fullName">${fullName}</p>`;
                    }

                    content.innerHTML = 
                    `<div class="popper-node-container"> 
                            <div class="popper-node-title">
                                ${nameLine}
                                ${fullNameLine}
                            </div>
                            <hr>
                            <i>${type}, ${status}</i>
                            <br>
                            <p>${summary}</p>
                        </div>`;
                }

                document.body.appendChild(content);
                return content;
            }
        });

        event.runOnce = true;
    });
    
    let destroyPop = ((event) => {
        if (event.target.popper) {
            event.target.popperRefObj.state.elements.popper.remove();
            event.target.popperRefObj.destroy();
        }
    });

    // cyGraph.elements().unbind("unselect");
    // cyGraph.elements().bind("unselect", destroyPop);
    // cyGraph.elements().unbind("viewport");
    // cyGraph.elements().bind("viewport", destroyPop);
    let episodeNum = graphIndex+1;

    // Set up header
    document.getElementById("episode-title").innerHTML = `MAG ${episodeNum}<br> ${rawGraphSteps[graphIndex].episodeName}`;
    const seasonNumber = Math.floor((parseInt(episodeNum) - 1) / 40);
    document.getElementById("season-title").innerHTML = `Season ${seasonNumber + 1}: ${seasonDescriptors[seasonNumber]}`;
}

const input = document.getElementById("timeslider");
input.addEventListener("input", function(event) {
    // PLEASE make sure this is not horrendously bad
    // It is, make an algorithm which finds differences between them and adds the missing in
    selectedGraph = event.target.value - 1;
    setUpGraph(selectedGraph);
});

// Start on episode 1
selectedGraph = rawPositions.findIndex((a) => {return !a});
setUpGraph(selectedGraph);

// Defined here for debug reasons
var cyGraph;

// Save button for things
document.getElementById("save").addEventListener("click", function() {
    // Array of arrays of arrays
    // Index with episode, then id, then x or y
    let fullMap = {}
    cyGraph.nodes().forEach((ele) => {fullMap[ele.id()] = ele.position()});
    rawPositions[selectedGraph] = fullMap;
    console.log(rawPositions);
    navigator.clipboard.writeText(JSON.stringify(rawPositions));
});

console.log(`Starting at ${selectedGraph + 1}`)
// Add thing to map number of changes per character
// console.log(changeCount);
