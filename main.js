import rawGraphSteps from './graphs.json';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import popper from 'cytoscape-popper';

cytoscape.use(cola);
cytoscape.use(popper);

// Only add things that are changed in newEntries, don't touch anything else
// TODO group change support
// TODO Add smooth adding
function accumulateGraph(oldGraph, newEntries) {
    // This makes a 1-deep copy of oldGraph, except for the relationships array, which is itself a 1-deep copy
    // This makes the relationships array empty if none is found, replace this
    let combined = oldGraph.map(a => ({...a, relationships: a.hasOwnProperty("relationships") ? a.relationships.map(b => ({...b})) : []}));
    for (const entry of newEntries) {
        // Since ids are sequential, any id that can be used to index oldGraph must be a replacement
        let intId = parseInt(entry.id);
        if (intId < combined.length) {
            // Replace as needed
            for (const [key, value] of Object.entries(entry)) {
                // Handle replacing relationships
                if (key == "relationships") {
                    for (const relationship of value) {
                        let index = -1;
                        for (let i = 0; i < combined[intId].relationships.length; i++) {
                            if (combined[intId].relationships[i].targetId == relationship.targetId) {
                                index = i;
                                break;
                            }
                        }

                        if (index >= 0) {
                            // If this is an existing relationship,
                            // Replace it
                            combined[intId].relationships[index] = relationship;
                        }
                        else {
                            // If this is a new relationship, just add it
                            combined[intId].relationships.push(relationship);
                        }
                    }
                }

                combined[intId][key] = value;
            }
        }
        else {
            // Concatenate
            combined.push(entry);
        }
    }

    return combined;
}

let graphSteps = [rawGraphSteps[0].episodeData];

console.log("Accumulating graph steps...")
// Accumulate the graph
for (let i = 1; i < rawGraphSteps.length; i++) {
    // Theoretically this passes by reference
    graphSteps.push(accumulateGraph(graphSteps[i-1], rawGraphSteps[i].episodeData));
}

console.log(graphSteps);

function formatGraph(graphList) {
    console.log("Formatting graph list...");
    // Create the nodes
    let formattedGraph = graphList.map((element) => {
        // Keep track of the inverse of relations that already exist
        let complementaryRelations = {};
        let completedRelations = {};

        for (const entry of element) {
            // If this is a group node, do other stuff
            // DUE TO HOW THIS WORKS, GROUPS MUST BE LISTED LAST
            if (entry.hasOwnProperty('groupName')) {
                console.log(entry.groupId);
                for (const memberId of entry.memberIds) {
                    
                }
                continue;
            }

            // If this entry has no relationships, skip it
            if (!entry.hasOwnProperty('relationships') || entry.relationships.length == 0) {
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
        }

        return {elements: element.map((entry) => ({data: entry})).concat(Object.values(completedRelations))};
    });
    return formattedGraph;
}

var graphs = formatGraph(graphSteps);

let graphStyling = {
    style: [
        {
            selector: 'node[displayName]',
            style: {
                shape: 'ellipse',
                label: 'data(displayName)',
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
        {
            selector: 'edge[type = \'Acquaintances\']',
            style: {
                targetArrowColor: 'yellow',
                lineColor: 'yellow',
            },
        },
        {
            selector: 'edge[type = \'Friends\']',
            style: {
                targetArrowColor: 'green',
                lineColor: 'green',
            },
        },
        {
            selector: 'edge[type = \'Work\']',
            style: {
                targetArrowColor: 'blue',
                lineColor: 'blue',
            },
        },
    ],
};

function setUpGraph(graphIndex) {
    let data = graphs[graphIndex];
    let graph = {
        container: document.getElementById('cy'),
        ...graphStyling,
        ...data, 
    };

    let layoutOptions = {
        name: 'cola',
        animate: true, // whether to show the layout as it's running
        refresh: 1, // number of ticks per frame; higher is faster but more jerky
        maxSimulationTime: 4000, // max length in ms to run the layout
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

    // Until cola looks good, use cose
    layoutOptions = {
        name: 'cose',
        animate: false,
    };

    let cy = cytoscape(graph);
    let layout = cy.layout(layoutOptions);
    layout.run();

    cy.elements().unbind("mouseover");
    cy.elements().bind("mouseover", (event) => {
        event.target.popperRefObj = event.target.popper({
            content: () => {
                let content = document.createElement("html");

                // If this is a relationship element
                if (/^\d+-\d+$/.test(event.target.id())) {
                    //content.innerHTML = `<html> <head> <title>Page Title</title> </head> <body> <p>${content.target.name}: Coworkers with ${content.target.name}</p> <hr> <p>Gertrude Robinson: Replacement for Jonathan Simms</p> </body> </html>`;
                }
                // Otherwise it is a normal one
                else {
                    content.innerHTML = `<html> <head> <title>Page Title</title> </head> <body> <p>${event.target.name}</body> </html>`; 
                }

                document.body.appendChild(content);
                return content;
            },
        });
    });

    cy.elements().unbind("mouseout");
    cy.elements().bind("mouseout", (event) => {
        if (event.target.popper) {
            event.target.popperRefObj.state.elements.popper.remove();
            event.target.popperRefObj.destroy();
        }
    });
}

const input = document.getElementById("timeslider");
input.addEventListener("input", function(event) {
    // PLEASE make sure this is not horrendously bad
    setUpGraph(event.target.value - 1);
});

// Debug code: use the last graph
console.log(`Displaying graph: ${graphs.length - 1}`);
setUpGraph(graphs.length - 1);

// Layout of an entry in graphs:
/*
    {
        "episodeNum": "",
        "episodeName": "",
        "episodeData": [
            {
                "displayName": "",
                "fullName": "",
                "id": "",
                "wikiLink": "",
                "imageFile": "",
                "type": "Human",
                "status": "Alive",
                "mindset": "",
                "summary": "",
                "alignment": "None",
                "relationships": [
                    {
                        "targetId": "",
                        "type": "",
                        "text": "",
                        "feeling": ""
                    }
                ]
            }
        ]
    }
*/
