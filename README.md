# Neighborhood-Preserving-Voronoi-Treemaps

## About

Neighborhood Preserving Voronoi Treemaps is an adaptation of traditional weighted Voronoi treemaps.  
The goal of the technique is to preserve existing similarities within the data as neighborhoods in the Voronoi treemap.
In this repository, you will find a link to the current, preliminary tool and a preliminary version of the code. 
A more polished version will be released upon publication.  

# Online Tool
We are hosting a preliminary version of the tool at [https://voronoitreemap.de](https://voronoitreemap.de).
The tool has only been tested on a 4k monitor with the Chrome browser.
We plan to test for other browsers and smaller resolutions in the future.

# Running with Docker

The easiest way to run the tool without installing Node.js locally is via Docker.

**Build the image:**
```bash
docker build -t voronoi-treemaps .
```

**Run (static build, source baked in):**
```bash
docker run -p 5173:5173 voronoi-treemaps
```

**Run with live hot-reload (edits to `src/` are reflected immediately):**
```bash
docker run -p 5173:5173 -v ${PWD}/src:/app/src voronoi-treemaps
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

> You only need to rebuild the image when `package.json` or the `Dockerfile` changes.

# Installation

If using IntelliJ, stick with node v16, as otherwise IntelliJ has a problem debugging local modules.

We have to link after each npm install run. First, you have to add the libraries at the location.

```bash
npm install
cd modules/d3-voronoi-map | npm link
cd modules/d3-weighted-voronoi | npm link
npm link d3-voronoi-map d3-weighted-voronoi

npm install modules/d3-weighted-voronoi modules/d3-voronoi-map
```

Add additional libs using

```bash
npx svelte-add@latest tailwindcss pnpm install
```

# Data Import

The tool accepts hierarchical JSON files placed in `src/data/`.  
Leaf nodes should have an `embeddings` array (used for PCA projection and similarity computation).  
See the existing files in `src/data/` for the expected schema.

## Converting Newick phylogenetic trees

A utility script is included to convert `.nwk` (Newick format) phylogenetic tree files into the
JSON format expected by the tool:

```bash
node nwk_to_json.mjs <input.nwk> src/data/<output.json> "Display Name"
```

**Example:**
```bash
node nwk_to_json.mjs Actinopterygii_orders.nwk src/data/actinopterygii_orders.json "Actinopterygii Orders"
```

Leaf nodes receive one-hot `embeddings` vectors. With `useInternalEmbeddings: true` the tool
averages child embeddings upward, so phylogenetically close taxa end up with similar embeddings,
driving the neighbourhood-preserving layout.

# Exporting Results

## SVG Export

Once the Final Voronoi Treemap Visualization has finished computing, an **Export SVG** button
appears below it. Clicking it downloads the current treemap as `voronoi_treemap.svg`, including
all polygon fills, labels, and puzzle-tab edges exactly as rendered.

## Spherical Voronoi — Constellation Lines Export (`spherical-voronoi-tesselation` branch)

The `spherical-voronoi-tesselation` branch adds a native spherical Voronoi tessellation of the
leaf nodes rendered as an interactive, rotatable globe (using `d3-geo-voronoi` and
`d3.geoOrthographic`). Each leaf's flat-treemap centroid is mapped to longitude/latitude,
preserving the neighbourhood structure established by the 2D optimisation on the sphere surface.

An **Export Constellation Lines** button downloads `voronoi_neighborhoods.dat`, a file
compatible with [OpenSpace](https://www.openspaceproject.com/)'s `RenderableConstellationLines`
module. The format mirrors the IAU constellation boundary file `bound_20.dat`:

```
{RA:10.7f} {Dec:+11.7f} {IDENTIFIER}  I
```

- **RA** — right ascension in decimal hours (longitude ÷ 15), range 0–24 h  
- **Dec** — declination in degrees with explicit sign (`+`/`-`), no space before the number  
- **IDENTIFIER** — node display name (spaces replaced with `_`)  
- **I** — all vertices are interior/connected; OpenSpace renders each region as a `GL_LINE_LOOP`

# Disclaimer

The Voronoi implementation builds upon the excellent d3 projects d3-weighted-voronoi and d3-voronoi-map by LEBEAU Franck.
Our project includes forks of both repositories and is in no way involved with or supported by the creators of d3-weighted-voronoi and d3-voronoi-map.


