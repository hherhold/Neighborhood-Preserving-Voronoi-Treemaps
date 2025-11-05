<script>

    import {
        initializationStrategies,
        matchingDone,
        matchingStore,
        selectedInitializationStrategyID,
        voronoiEdgesByRank
    } from "../store";
    import {onMount} from "svelte";

    import {
        Bodies,
        Body,
        Composite,
        Constraint,
        Engine,
        Events,
        Mouse,
        MouseConstraint,
        Render,
        Runner
    } from 'matter-js';

    export let depth = [];
    export let links = [];
    export let forceBasedInitializationFinished = false;
    export let initializedPositions = false;
    export let height
    export let width

    let canvas;
    let render
    let engine = Engine.create()
    engine.world.gravity.y = 0;
    engine.positionIterations = 20
    engine.velocityIterations = 20
    let mouse
    let runner = Runner.create();
    runner.delta = 1000 / 30
    runner.isFixed = true

    let world
    let isEqui = true
    let startGrow = false
    let circles = {}
    let mouseConstraint

    let count = 0
    let nodes

    let groups
    let groupIdx = 0

    let is_mounted = false


    onMount(() => {
        if ($initializationStrategies[$selectedInitializationStrategyID].name !== 'force') {
            forceBasedInitializationFinished = true
            return
        }

        count = 0
        render = Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width: width,
                height: height,
                fillStyle: '#f19648',
                wireframes: false,
                background: 'white'

            }
        });

        mouse = Mouse.create(render.canvas);
        mouseConstraint = MouseConstraint.create(engine, {
                mouse: mouse,
                constraint: {
                    stiffness: 0.2,
                    render: {
                        visible: false
                    }
                }
            });
        Composite.add(engine.world, mouseConstraint);

        Events.on(engine, "collisionActive", callbackcollisionStart)
        Events.on(runner, "afterTick", callbackbeforeTick)


        is_mounted = true

    });


    function getGroups(dataList, groupSize) {
        return dataList
            .slice(groupSize - 1)
            .map((_, index) => dataList.slice(index, index + groupSize));
    }

    function addOutsidePolygon(segments) {

        const options = {
            isStatic: true,
            density: 1,
            frictionAir: 1,
            render: {
                fillStyle: "none",
                strokeStyle: 'black',
                lineWidth: 3
            }
        }


        for (const line of segments) {
            const p1 = line[0]
            const p2 = line[1]
            const dx = p2[0] - p1[0]
            const dy = p2[1] - p1[1]
            const width = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx)
            const r = Bodies.rectangle((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, width, 20, options);
            const c1 = Bodies.circle(p1[0], p1[1], 2, options);
            Body.rotate(r, angle)
            Composite.add(engine.world, [c1, r]);
        }

    }

    // forceBasedInitializationFinished = true


    $:if (
        depth.length > 0
        && matchingDone
        && initializedPositions
        && depth[0].depth + 1 in $matchingStore
        // && Object.values(nodes)[0].data.initialPos.hasOwnProperty('x')
        // && Object.values(nodes)[0].data.initialPos.hasOwnProperty('y')
        && !forceBasedInitializationFinished
        && is_mounted
    ) {

        console.log("Create force-based initialization for rank " + depth[0].depth)

        Render.run(render);
        Runner.run(runner, engine);

        count = 0

        nodes = depth.reduce((acc, node) => {
            return [...acc, ...(node.children || [])]
            }, []
        );

        let segments
        if (nodes[0].depth > 1) {
            segments = $voronoiEdgesByRank[nodes[0].depth - 2].map((d) => d.line)

        } else {
            segments = $voronoiEdgesByRank[nodes[0].depth - 1].filter((d) => (d.targetPolygon === -1 || d.sourcePolygon === -1)).map((d) => d.line)

        }
        addOutsidePolygon(segments)

        groups = findGroups2(nodes, links)
        addGroups2()

    }

    function addGroups2() {
        for (const nodeid of [...groups[groupIdx].nodes]) {
            //for (const node of nodes) {

            const node = nodes.filter((d) => d.data.id === nodeid)[0]
            if (node !== undefined && node.hasOwnProperty('data') && node.data.hasOwnProperty('initialPos') && node.data.initialPos !== undefined && node.data.initialPos.hasOwnProperty('centroid')) {
                const c = Bodies.circle(...node.data.initialPos.centroid, 20, {
                    render: {
                        fillStyle: node.data.color || "none",
                        strokeStyle: 'black',
                        lineWidth: 5
                    }
                });
                Composite.add(engine.world, c);
                circles[node.data.id] = c
                c["stopGrow"] = false
                c["canGrow"] = false
                c["node"] = node

                Body.applyForce(c, c.position, {x: 0.005 * (2 * Math.random() - 1), y: 0.005 * (2 * Math.random() - 1)})
            }
        }


        for (const link of groups[groupIdx].links) {

            if (nodes[0].depth > 1) {
                // check propertyneighboursclipped if parent of target is neighbour

                const sourceNode = nodes.filter((d) => d.data.id === link.sourceID)[0]
                const targetNode = nodes.filter((d) => d.data.id === link.targetID)[0]
                if (sourceNode !== undefined && targetNode !== undefined && sourceNode.parent.data.id !== targetNode.parent.data.id) {
                    const sourceNodeParentNeighbours = new Set(sourceNode.parent.site.filter((d) => d.id !== -1).map((d) => d.id))
                    if (!sourceNodeParentNeighbours.has(targetNode.parent.data.id)) {
                        continue
                    }
                }


            }
            if (link.sourceID in circles && link.targetID in circles) {
                const c1 = circles[link.sourceID]
                const c2 = circles[link.targetID]
                c1["canGrow"] = true
                c2["canGrow"] = true

                let stiffness = 0.001

                if (c1.node.parent.data.id !== c2.node.parent.data.id) {
                    stiffness = 0.03
                }

                const color = c1.render.fillStyle === "none" ? c1.render.strokeStyle : c1.render.fillStyle
                const constraintAB = Constraint.create({
                    bodyA: c1, bodyB: c2,

                    damping: 0.1,
                    length: 75,
                    stiffness: stiffness,
                    render: {
                        strokeStyle: color,
                        lineWidth: 3
                    }
                });
                Composite.add(engine.world, constraintAB);
            }
        }

    }

    function addGroups() {
        for (const nodeid of [...groups[groupIdx].nodes]) {
            //for (const node of nodes) {

            const node = nodes.filter((d) => d.data.id === nodeid)[0]
            if (node !== undefined && node.hasOwnProperty('data') && node.data.hasOwnProperty('initialPos') && node.data.initialPos !== undefined && node.data.initialPos.hasOwnProperty('centroid')) {
                const c = Bodies.circle(...node.data.initialPos.centroid, 20, {
                    render: {
                        fillStyle: node.data.color || "none",
                        strokeStyle: 'black',
                        lineWidth: 5
                    }
                });
                Composite.add(engine.world, c);
                circles[node.data.id] = c
                c["stopGrow"] = false
                c["canGrow"] = false
                c["node"] = node

                Body.applyForce(c, c.position, {x: 0.005 * (2 * Math.random() - 1), y: 0.005 * (2 * Math.random() - 1)})
            }
        }


        for (const link of groups[groupIdx].links) {

            if (nodes[0].depth > 1) {
                // check propertyneighboursclipped if parent of target is neighbour

                const sourceNode = nodes.filter((d) => d.data.id === link.sourceID)[0]
                const targetNode = nodes.filter((d) => d.data.id === link.targetID)[0]
                if (sourceNode !== undefined && targetNode !== undefined && sourceNode.parent.data.id !== targetNode.parent.data.id) {
                    const sourceNodeParentNeighbours = new Set(sourceNode.parent.site.intersectedgesObjects.map(d => d.target))
                    // const sourceNodeParentNeighbours = new Set(sourceNode.parent.site.propertiesNeighboursClipped.filter((d) => d.id !== -1).map((d) => d.id))
                    if (!sourceNodeParentNeighbours.has(targetNode.parent.data.id)) {
                        continue
                    }
                }


            }
            if (link.sourceID in circles && link.targetID in circles) {
                const c1 = circles[link.sourceID]
                const c2 = circles[link.targetID]
                c1["canGrow"] = true
                c2["canGrow"] = true

                let stiffness = 0.0005

                if (c1.node.parent.data.id !== c2.node.parent.data.id) {
                    stiffness = 0.005
                }

                const color = c1.render.fillStyle === "none" ? c1.render.strokeStyle : c1.render.fillStyle
                const constraintAB = Constraint.create({
                    bodyA: c1, bodyB: c2,

                    damping: 0.1,
                    length: 75,
                    stiffness: stiffness,
                    render: {
                        strokeStyle: color,
                        lineWidth: 3
                    }
                });
                Composite.add(engine.world, constraintAB);
            }
        }

    }

    function callbackbeforeTick() {

        if (Object.keys(circles).length === 0) {
            return;
        }
        count++

        for (let [key, value] of Object.entries(circles)) {

            if (!value.stopGrow && value.canGrow && groupIdx === groups.length - 1) {
                Body.scale(value, 1.002, 1.002)

            }

            if (value.circleRadius > 100) {
                // value.canGrow = false
            }
        }

        if (count > 100 && Object.keys(circles).length > 0) {
            if (groupIdx === groups.length - 1) {
                if (count > 500) {
                    Render.stop(render);
                    Runner.stop(runner, engine);
                    optimizationFinish()
                }

            } else {
                groupIdx++
                count = 0
                addGroups()
            }

        }
        /* const all_stopped = Object.values(circles).every((d) => d.stopGrow)
         if (all_stopped && Object.keys(circles).length > 0) {
             Render.stop(render);
             Runner.stop(runner, engine);
             optimizationFinish();
         }*/
    }

    function callbackcollisionStart(event) {

        for (let [key, value] of Object.entries(circles)) {

            value.stopGrow = !value.canGrow

        }


        for (const pair of event.pairs) {

            if (pair.collision.depth > 5) {
                pair.collision.bodyA["stopGrow"] = true
                pair.collision.bodyB["stopGrow"] = true
            }

        }
    }

    function optimizationFinish() {
        let nodes = depth.reduce((acc, node) => {
            return [...acc, ...(node.children || [])]
            }, []
        );

        for (const node of nodes) {
            const c = circles[node.data.id]
            if (c !== undefined) {
                node.data.initialPos.x = c.position.x
                node.data.initialPos.y = c.position.y
            }


        }
        forceBasedInitializationFinished = true
    }

    function findGroups(nodes, links) {
        const groups = []

        for (const node of nodes) {
            groups.push({"nodes": new Set([node.data.id]), "links": []})

        }


        for (const link of links) {
            /* if (groups.length === 0) {
                groups.push({"nodes": new Set([link.targetID, link.sourceID]), "links": [link]})
                continue
            }*/
            let sourceGroup = null
            let targetGroup = null
            let targetGroupIdx
            let sourceGroupIdx

            for (let [idx, group] of groups.entries()) {
                if (group.nodes.has(link.sourceID)) {
                    sourceGroup = group
                    sourceGroupIdx = idx
                }
                if (group.nodes.has(link.targetID)) {
                    targetGroup = group
                    targetGroupIdx = idx
                }
            }

            /*
            if (sourceGroup === null && targetGroup === null) {
                groups.push({"nodes": new Set([link.targetID, link.sourceID]), "links": [link]})
                continue
            }

            if (sourceGroup !== null && targetGroup === null) {
                sourceGroup.nodes.add(link.targetID)
                sourceGroup.links.push(link)
                continue
            }
            if (sourceGroup === null && targetGroup !== null) {
                targetGroup.nodes.add(link.sourceID)
                targetGroup.links.push(link)
                continue
            }

             */
            if (sourceGroup === targetGroup) {
                sourceGroup.links.push(link)
                continue
            }


            if (sourceGroup !== null && targetGroup !== null) {
                groups.splice(targetGroupIdx, 1)
                sourceGroup.nodes = new Set([...sourceGroup.nodes, ...targetGroup.nodes])
                sourceGroup.links.push(...targetGroup.links)
                sourceGroup.links.push(link)
                continue
            } else {
                console.log("err")
            }

        }
        groups.sort((a, b) => (b.links.size - a.links.size));

        return groups
    }

    function findGroups2(nodes, links) {
        let groups = []

        const dict = {}

        for (const node of nodes) {
            groups.push({"nodes": new Set([node.data.id]), "links": []})
            dict[node.data.id] = node

        }
        let singles = groups.filter(d => d.links.length === 0)


        singles = singles.reduce(
            (accumulator, currentValue) => {
                accumulator.nodes = new Set([...currentValue.nodes, ...accumulator.nodes])
                return accumulator
            },
            {"nodes": new Set(), "links": []},);

        if (singles.nodes.size > 0) {
            groups = [singles, ...groups.filter(d => d.links.length > 0)]

        }

        const multi_links = []
        const same_links = []

        for (const link of links) {

            const sourceNode = dict[link.sourceID]
            const targetNode = dict[link.targetID]
            if (sourceNode.parent.data.id !== targetNode.parent.data.id) {
                multi_links.push(link)
            } else {
                same_links.push(link)
            }

        }
        groups.push({"nodes": new Set(), "links": multi_links})
        groups.push({"nodes": new Set(), "links": same_links})
        return groups
    }

</script>
<!--<div class="col-span-2" id="test">-->
    <canvas bind:this={canvas} height="{height}" style="background-color: black" width="{width}"></canvas>
<!--</div>-->