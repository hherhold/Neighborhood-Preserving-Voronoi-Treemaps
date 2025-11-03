import {readable, writable} from 'svelte/store';

import {prng_alea} from 'esm-seedrandom';
import {jaccard} from "@saehrimnir/druidjs";
import {binarySimilarity, cosineSimilarity} from "./helpers/helpers.js";
import * as d3 from "d3";

//Dict of the nodes
export const dict = writable({});
export const pairLinks = writable([]);
export const counter = createCount();
// export const counterOptimizationSteps = createCountOptimizationSteps();

export let randomSeed = writable('vis25_submission');

export let initializationStrategies = writable([
    {id: 0, name: 'random'},
    {id: 1, name: 'pie'},
    //{id: 2, name: 'projectionMapping'},
    // {id: 3, name: 'force'},
    {id: 2, name: 'swapping'}
]);
export const selectedInitializationStrategyID = writable(2);
export let similarityMeasuresBaseline = writable([]);

export let similarityMeasuresBaselinePercentagePreserved = writable("");
export let similarityMeasuresBaselineNumberPreserved = writable("");

export let averageBoundingBoxAspectRatio = writable(0);


export let myseededprng = prng_alea(randomSeed);
export let myseededprngBaseline = prng_alea(randomSeed); // (from seedrandom's doc) Use "new" to create a local pprng without altering Math.random //world.Its me
const resetGeneralStore = function () {
    dict.set({});
    pairLinks.set([]);
    counter.reset();
    averageBoundingBoxAspectRatio.set(0);
    myseededprng = prng_alea(randomSeed);
    myseededprngBaseline = prng_alea(randomSeed);
}

//DataImporterStore
export const datasetID = writable(3);
export const dataStore = writable({});
export const externalInitialization = writable({});
export const shouldShuffle = writable(false);
export const useInternalEmbeddings = writable(false);
export const initializeWithPrecomputedPositions = writable(false);
export const simAttribute = writable('embeddings');
export const weightAttribute = writable('none');
export const useNeighborLeafs = writable(false);

export const useSimilarityMatrix = writable(false);
export const similarityMeasure = writable('cosine');
export const useCategoricalColors = writable(false);
export const tableau20 = ['#4E79A7','#F28E2B','#59A14F', '#B6992D',
    '#499894', '#E15759', '#79706E', '#D37295',
    '#B07AA1', '#9D7660',
    '#A0CBE8', '#FFBE7D',
    '#8CD17D', '#F1CE63', '#86BCB6', '#FF9D9A',
    '#BAB0AC', '#FABFD2', '#D4A6C8', '#D7B5A6']
export const colorScale = writable(d3.scaleOrdinal(tableau20));
export const similarityMeasureDict = readable({
    "jaccard": (a, b) => 1 - jaccard(a, b),
    "cosine": (a, b) => cosineSimilarity(a, b),
    "binary": (a, b) => binarySimilarity(a, b),


});
export const loadedDataset = writable(false);
export const doubleSidedAttractionLinks = writable(true);
const resetDataImporterStore = function () {
    dataStore.set({});
    externalInitialization.set({})
    shouldShuffle.set(false)
    useInternalEmbeddings.set(false);
    initializeWithPrecomputedPositions.set(false);
    simAttribute.set('embeddings');
    weightAttribute.set('none');
    loadedDataset.set(false);
    useNeighborLeafs.set(false);
    useSimilarityMatrix.set(false)
}

//projectionStore
export const projectionStore = writable({});
export const projectionStoreDepth = writable({});
export const projectionStoreDepthDict = writable({});
export const colorsProjectionsStore = writable([]);
export const vectorStore = writable({});
export const similarityStore = writable({});
export const projectionDone = writable(false);
const resetProjectionStore = function () {
    projectionStore.set({});
    projectionStoreDepth.set({});
    projectionStoreDepthDict.set({});
    colorsProjectionsStore.set([]);
    vectorStore.set({});
    similarityStore.set({});
    projectionDone.set(false);
}

//voronoiTreemapStore
export const currentDepth = writable(0);
export const queueGroupFinished = writable([]);
export const queueGrouped = writable([]);
export const queueGroupedBaselineClone = writable([]);
export const voronoiCellsGroupedNSteps = writable({});
export const similarityGraphGroupedNSteps = writable({});
export const neighborhoodGraphGroupedNSteps = writable({});
export const stepsSoFar = writable({});
const resetVoronoiTreemapStore = function () {
    currentDepth.set(0);
    queueGroupFinished.set([]);
    queueGrouped.set([]);
    voronoiCellsGroupedNSteps.set({});
    stepsSoFar.set({});
    hover_set.set([]);
    constraintsHoverSet.set([])
}

export const hover_set = writable([]);
export const constraintsHoverSet = writable([]);
export const tabMultiplier = writable(1)
export const edgeMultiplier = writable(1)
//voronoiStore
export const voronoiStore = writable({});
export const voronoiStoreID = writable({});
export const voronoiStoreIDRoot = writable({});
export const voronoiStoreIDOptimized = writable({});
export const voronoiStoreIDOptimizedBaseline = writable({});
export const voronoiStoreIDOptimizedParentsBaseline = writable({});
export const voronoiStoreIDOptimizedD = writable({});
export const voronoiRelaxationDone = writable(false);
const resetVoronoiStore = function () {
    voronoiStore.set({});
    voronoiStoreID.set({});
    voronoiStoreIDRoot.set({});
    voronoiStoreIDOptimized.set({});
    voronoiStoreIDOptimizedBaseline.set({});
    voronoiStoreIDOptimizedParentsBaseline.set({});
    voronoiStoreIDOptimizedD.set({});
    voronoiRelaxationDone.set(false);
}

//matchingStore
export const matchingStore = writable({});
export const matchingStoreString = writable({});
export const matchingDone = writable(false);
const resetMatchingStore = function () {
    matchingStore.set({});
    matchingStoreString.set({});
    matchingDone.set(false);
}

//optimizedVoronoiStore
export const voronoiStoreOptimized = writable({});
export const voronoiCells = writable({});

export const maxIterations = writable(150);//150
export const maxSwaps = writable(4);//150
const resetOptimizedVoronoiStore = function () {
    voronoiStoreOptimized.set({});
    voronoiCells.set({});
}
export const clippingPolygonOuter = writable([]);

//voronoiEdgesStore
export const voronoiEdges = writable({});
export const voronoiEdgesByRank = writable({});
export const voronoiEdgesAll = writable([]);
export const medSimStore = writable({});
export const medSimStoreBorder = writable({});
const resetVoronoiEdgesStore = function () {
    voronoiEdges.set({});
    voronoiEdgesByRank.set({});
    voronoiEdgesAll.set([]);
    medSimStore.set({});
    medSimStoreBorder.set({});
}

//FinalTreemapStore
export const finalPolygons = writable([]);
const resetFinalTreemapStore = function () {
    clippingPolygonOuter.set([])
    finalPolygons.set([]);
}

//Visual settings
export const circleSize = writable(10);
export const visualizationWidth = writable(100);
export const offsetStroke = writable(30);
export const attractionLinksPerRankNSteps = writable({});
export const attractionLinksTotal = writable([]);
export const attractionLinksPreservedTotal = writable(0);
export const averageConverganceRate = writable(0);
export const attractionLinksPercentage = writable(0);
export const linkIntersectionsPerRankNSteps = writable({});
export const showNames = writable(true);
export const showIcons = writable(true);
export const showmissingLinks = writable(false);
export const showSimilarityConstraints = writable(false);
export const showVectors = writable(false);
///reset store
export const resetStore = function () {
    resetGeneralStore();
    resetDataImporterStore();
    resetProjectionStore();
    resetVoronoiTreemapStore();
    resetVoronoiStore();
    resetMatchingStore();
    resetOptimizedVoronoiStore();
    resetVoronoiEdgesStore();
    resetFinalTreemapStore();
    attractionLinksPerRankNSteps.set({});
    attractionLinksTotal.set([])
    attractionLinksPreservedTotal.set(0)
    averageConverganceRate.set(0)
    attractionLinksPercentage.set(0)
    linkIntersectionsPerRankNSteps.set({})
}

///counter
function createCount() {
    const {subscribe, set, update} = writable(0);

    return {
        subscribe,
        increment: () => {
            update(n => n + 1)
        },
        decrement: () => {
            update(n => n - 1)
        },
        reset: () => set(0)
    };
}

