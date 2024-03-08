import rawGraphSteps from './graphs.json';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import popper from 'cytoscape-popper';
import tippy from 'tippy.js';


// Initialize cy plugins
cytoscape.use(cola);
cytoscape.use(popper);

// Season descriptors
let seasonDescriptors = ["Something's Off", "It Could Be Anyone", "Knowledge is Power", "A New Low", "The End"]

// Only add things that are changed in newEntries, don't touch anything else
function accumulateGraph(oldGraph, newEntries) {
    // This makes a 1-deep copy of oldGraph, except for the relationships array, which is itself a 1-deep copy
    // This makes the relationships array empty if none is found, replace this
    let combined = {
        characters: oldGraph.characters.map(a => ({...a, relationships: a.hasOwnProperty("relationships") ? a.relationships.map(b => ({...b})) : []})), 
        groups: oldGraph.groups.map(c => ({...c}))
    };

    // Manage the characters

    for (const character of newEntries.characters) {
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
                                break;
                            }
                        }

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

    // Manange the groups
    if (newEntries.groups) {
        for (const group of newEntries.groups) {
            // Since ids are sequential, any id that can be used to index oldGraph must be a replacement
            let groupId = parseInt(group.groupId);
            if (groupId < combined.groups.length) {
                // Replace as needed
                // This means that members will have to be replaced all at once: every member must be listed every time
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

console.log("Accumulating graph steps...")
// Accumulate the graph
for (let i = 1; i < rawGraphSteps.length; i++) {
    // Theoretically this passes by reference
    graphSteps.push(accumulateGraph(graphSteps[i-1], {characters: rawGraphSteps[i].episodeCharacters, groups: rawGraphSteps[i].episodeGroups}));
}

// Listing graph
console.log(graphSteps);

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


                // If there is already a version of this completed, mark it nondirectional
                if (complementaryRelations.hasOwnProperty(potentialId) && complementaryRelations[potentialId] == relation.type) {
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
                for (const relation of group.relationships)
                {
                    // The id of this entry, should it go through
                    let potentialId = `${cyId}-${relation.targetId}`;
                    let inverseId = `${relation.targetId}-${cyId}`;

                    // If there is already a version of this completed, mark it nondirectional
                    if (complementaryRelations.hasOwnProperty(potentialId) && complementaryRelations[potentialId] == relation.type) {
                        completedRelations[inverseId].data.directed = false;
                        continue;
                    }

                    // Add the inverse to the list of inverse relations
                    complementaryRelations[inverseId] = relation.type;
                    completedRelations[potentialId] = 
                    {
                        data: {
                            id: potentialId,
                            source: cyId,
                            target: relation.targetId,
                            type: relation.type,
                            text: relation.text,
                            feeling: relation.feeling,
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

    let layoutOptions = {
        name: 'cola',
        animate: true, // whether to show the layout as it's running
        refresh: 3, // number of ticks per frame; higher is faster but more jerky
        maxSimulationTime: 2000, // max length in ms to run the layout
        ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
        fit: true, // on every layout reposition of nodes, fit the viewport
        padding: 30, // padding around the simulation
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        nodeDimensionsIncludeLabels: true, // whether labels should be included in determining the space used by a node

        // layout event callbacks
        ready: function(){}, // on layoutready
        stop: function(){}, // on layoutstop

        // positioning options
        randomize: false, // use random node positions at beginning of layout
        avoidOverlap: true, // if true, prevents overlap of node bounding boxes
        handleDisconnected: true, // if true, avoids disconnected components from overlapping
        convergenceThreshold: 0.01, // when the alpha value (system energy) falls below this value, the layout stops
        nodeSpacing: function( node ){ return 10; }, // extra spacing around nodes
        flow: undefined, // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
        alignment: undefined, // relative alignment constraints on nodes, e.g. {vertical: [[{node: node1, offset: 0}, {node: node2, offset: 5}]], horizontal: [[{node: node3}, {node: node4}], [{node: node5}, {node: node6}]]}
        gapInequalities: undefined, // list of inequality constraints for the gap between the nodes, e.g. [{"axis":"y", "left":node1, "right":node2, "gap":25}]
        centerGraph: true, // adjusts the node positions initially to center the graph (pass false if you want to start the layout from the current position)

        // different methods of specifying edge length
        // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
        edgeLength: undefined, // sets edge length directly in simulation
        edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
        edgeJaccardLength: undefined, // jaccard edge length in simulation

        // iterations of cola algorithm; uses default values on undefined
        unconstrIter: undefined, // unconstrained initial layout iterations
        userConstIter: undefined, // initial layout iterations with user-specified constraints
        allConstIter: undefined, // initial layout iterations with all constraints including non-overlap
    };

    let graph = {
        container: document.getElementById('cy'),
        style: graphStyling,
        layout: layoutOptions,
        minZoom: 0.3,
        maxZoom: 3,
        ...data,
   };

    let cy = cytoscape(graph);

    cy.elements().unbind("select");
    cy.elements().bind("select", (event) => {

        // Prevent parents from double-displaying a page
        if (event.runOnce) {
            return;
        }

        event.target.popperRefObj = event.target.popper({
            content: () => {
                let content = document.createElement("html");

                // If this is a relationship element
                if (/^\d+-\d+$/.test(event.target.id())) {
                    content.innerHTML = 
                    `<div class="popper-relationship-container">
                            <p>${data.elements[parseInt(event.target._private.data.source)].data.displayName}: ${event.target._private.data.text} ${data.elements[parseInt(event.target._private.data.target)].data.displayName}</p>
                        </div>`;
                }
                // Otherwise it is a normal one
                else {
                    content.innerHTML = 
                    `<div class="popper-node-container"> 
                            <div class="popper-node-title">
                                <p class="displayName">${event.target._private.data.displayName}</p>
                                <p class="fullName">${event.target._private.data.fullName}</p>
                            </div>
                            <hr>
                            <i>${event.target._private.data.type}, ${event.target._private.data.status}</i>
                            <br>
                            <p>Feeling: ${event.target._private.data.mindset}</p>
                            <p>${event.target._private.data.summary}</p>
                        </div>`;
                }

                document.body.appendChild(content);
                return content;
            },
            style: {
                "border-radius": "30px"
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

    cy.elements().unbind("unselect");
    cy.elements().bind("unselect", destroyPop);
    cy.elements().unbind("viewport");
    cy.elements().bind("viewport", destroyPop);

    // Set up header
    document.getElementById("episode-title").innerHTML = `MAG ${rawGraphSteps[graphIndex].episodeNum}<br> ${rawGraphSteps[graphIndex].episodeName}`;
    const seasonNumber = Math.floor((parseInt(rawGraphSteps[graphIndex].episodeNum) - 1) / 40);
    document.getElementById("season-title").innerHTML = `Season ${seasonNumber + 1}: ${seasonDescriptors[seasonNumber]}`;
}

const input = document.getElementById("timeslider");
input.addEventListener("input", function(event) {
    // PLEASE make sure this is not horrendously bad
    setUpGraph(event.target.value - 1);
});

// Debug code: use the last graph
console.log(`Displaying graph: ${graphs.length}`);
setUpGraph(graphs.length - 1);
