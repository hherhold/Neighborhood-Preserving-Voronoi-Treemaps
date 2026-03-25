# Use Node 18 LTS (Alpine for smaller image)
FROM node:18-alpine

WORKDIR /app

# Copy package.json and local modules first for better layer caching.
# The local d3-voronoi-map and d3-weighted-voronoi modules are referenced as
# file: paths in package.json, so they must be present before npm install.
COPY package.json ./
COPY modules/ ./modules/

# Install all dependencies.
# npm resolves the file: references to the local modules automatically.
RUN npm install

# Copy the rest of the source
COPY . .

# Vite dev server default port
EXPOSE 5173

# Start the development server.
# vite --host (set in the "dev" script) binds to 0.0.0.0,
# making it reachable from outside the container.
CMD ["npm", "run", "dev"]
