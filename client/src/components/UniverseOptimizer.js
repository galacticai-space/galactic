import * as THREE from 'three';

class UniverseOptimizer {
  constructor() {
    // Increased chunk size and reduced initial render distance for better initial load
    this.chunks = new Map();
    this.chunkSize = 250; // Increased from 200
    this.visibleChunks = new Set();
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
    this.boundingSpheres = new Map();
    this.loadedChunks = new Set();
    this.chunkLoadQueue = [];
    this.isLoading = false;
    this.lastUpdate = 0;
    this.updateInterval = 100; // ms between updates
    
    // Progressive loading parameters
    this.loadingPhase = 'initial';
    this.initialLoadComplete = false;
    
    // Dynamic parameters with more conservative initial values
    this.dynamicParams = {
      minRadius: 200,
      maxRadius: 800,
      verticalSpread: 300,
      densityFactor: 0.8,
      renderDistance: 2, // Start with smaller render distance
      maxGalaxiesPerChunk: 40, // Start with fewer galaxies per chunk
      initialLoadDelay: 50, // ms between chunk loads during initial phase
      normalLoadDelay: 100, // ms between chunk loads during normal operation
      updateThrottle: 100 // ms between visible chunk updates
    };

    // Batch processing parameters
    this.batchSize = 50; // Process galaxies in smaller batches
    this.currentBatch = 0;
  }

  initializeChunks(camera) {
    this.camera = camera;
    this.updateVisibleChunks();
    this.startProgressiveLoading();
  }

  startProgressiveLoading() {
    // Start with minimal rendering and gradually increase
    setTimeout(() => {
      this.dynamicParams.renderDistance = 3;
      this.dynamicParams.maxGalaxiesPerChunk = 50;
      
      setTimeout(() => {
        this.dynamicParams.renderDistance = 4;
        this.dynamicParams.maxGalaxiesPerChunk = 70;
        this.initialLoadComplete = true;
        this.loadingPhase = 'normal';
      }, 2000); // Full load after 2 seconds
    }, 1000); // First upgrade after 1 second
  }

  calculateUniverseParams(galaxyCount, fps) {
    // More aggressive FPS-based adjustments
    if (fps < 30) {
      this.dynamicParams.renderDistance = Math.max(2, this.dynamicParams.renderDistance - 1);
      this.dynamicParams.maxGalaxiesPerChunk = Math.max(30, this.dynamicParams.maxGalaxiesPerChunk - 10);
    } else if (fps > 55) {
      this.dynamicParams.renderDistance = Math.min(4, this.dynamicParams.renderDistance + 1);
      this.dynamicParams.maxGalaxiesPerChunk = Math.min(70, this.dynamicParams.maxGalaxiesPerChunk + 10);
    }

    return this.dynamicParams;
  }

  getChunkKey(position) {
    const x = Math.floor(position[0] / this.chunkSize);
    const y = Math.floor(position[1] / this.chunkSize);
    const z = Math.floor(position[2] / this.chunkSize);
    return `${x},${y},${z}`;
  }

  updateChunks(galaxies, positions) {
    // Process galaxies in batches to avoid frame drops
    const batchStart = this.currentBatch * this.batchSize;
    const batchEnd = Math.min(batchStart + this.batchSize, galaxies.length);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const pos = positions[i];
      const chunkKey = this.getChunkKey(pos);
      
      if (!this.chunks.has(chunkKey)) {
        this.chunks.set(chunkKey, new Set());
      }
      this.chunks.get(chunkKey).add({
        galaxy: galaxies[i],
        position: pos,
        index: i
      });

      // Optimize bounding sphere calculation
      const sphere = new THREE.Sphere(
        new THREE.Vector3(...pos),
        Math.min(20, Math.sqrt(galaxies[i].transactions.length) * 2)
      );
      this.boundingSpheres.set(i, sphere);
    }

    this.currentBatch++;
    if (batchEnd < galaxies.length) {
      requestAnimationFrame(() => this.updateChunks(galaxies, positions));
    } else {
      this.currentBatch = 0;
    }
  }

  updateVisibleChunks() {
    if (!this.camera) return;

    // Throttle updates
    const now = performance.now();
    if (now - this.lastUpdate < this.dynamicParams.updateThrottle) return;
    this.lastUpdate = now;

    // Optimize frustum calculation
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projScreenMatrix.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse
      )
    );

    const previousVisible = new Set(this.visibleChunks);
    this.visibleChunks.clear();

    const cameraChunk = this.getChunkKey(this.camera.position.toArray());
    const [baseX, baseY, baseZ] = cameraChunk.split(',').map(Number);

    // Optimized chunk visibility check
    const renderDist = this.dynamicParams.renderDistance;
    for (let x = -renderDist; x <= renderDist; x++) {
      for (let y = -renderDist; y <= renderDist; y++) {
        for (let z = -renderDist; z <= renderDist; z++) {
          // Distance-based culling
          if (x * x + y * y + z * z > renderDist * renderDist) continue;

          const checkChunk = `${baseX + x},${baseY + y},${baseZ + z}`;
          if (!this.chunks.has(checkChunk)) continue;

          const chunkCenter = new THREE.Vector3(
            (baseX + x) * this.chunkSize + this.chunkSize / 2,
            (baseY + y) * this.chunkSize + this.chunkSize / 2,
            (baseX + z) * this.chunkSize + this.chunkSize / 2
          );
          
          if (this.frustum.containsPoint(chunkCenter)) {
            this.visibleChunks.add(checkChunk);
            if (!this.loadedChunks.has(checkChunk)) {
              this.queueChunkLoad(checkChunk);
            }
          }
        }
      }
    }

    // Clean up chunks that are no longer visible
    this.clearUnusedData(previousVisible);
  }

  async queueChunkLoad(chunkKey) {
    if (this.chunkLoadQueue.includes(chunkKey)) return;
    
    this.chunkLoadQueue.push(chunkKey);
    if (!this.isLoading) {
      this.processLoadQueue();
    }
  }

  async processLoadQueue() {
    if (this.isLoading || this.chunkLoadQueue.length === 0) return;
    
    this.isLoading = true;
    const chunkKey = this.chunkLoadQueue.shift();
    
    await new Promise(resolve => setTimeout(resolve, 
      this.loadingPhase === 'initial' ? 
      this.dynamicParams.initialLoadDelay : 
      this.dynamicParams.normalLoadDelay
    ));
    
    this.loadedChunks.add(chunkKey);
    this.isLoading = false;
    
    if (this.chunkLoadQueue.length > 0) {
      this.processLoadQueue();
    }
  }

  shouldRenderGalaxy(galaxyIndex, position) {
    const chunkKey = this.getChunkKey(position);
    
    if (!this.visibleChunks.has(chunkKey) || !this.loadedChunks.has(chunkKey)) {
      return false;
    }

    const sphere = this.boundingSpheres.get(galaxyIndex);
    if (!sphere) return true;
    
    return this.frustum.intersectsSphere(sphere);
  }

  getLODLevel(distance, fps) {
    if (!this.initialLoadComplete) return 0;
    
    const baseLOD = distance > 800 ? 0 : 
                    distance > 400 ? 1 : 2;
    
    return fps < 40 ? Math.max(0, baseLOD - 1) : baseLOD;
  }

  clearUnusedData(previousVisible) {
    for (const chunk of previousVisible) {
      if (!this.visibleChunks.has(chunk)) {
        this.loadedChunks.delete(chunk);
      }
    }
  }

  getStats() {
    return {
      visibleChunks: this.visibleChunks.size,
      loadedChunks: this.loadedChunks.size,
      queuedChunks: this.chunkLoadQueue.length,
      totalChunks: this.chunks.size,
      loadingPhase: this.loadingPhase,
      initialLoadComplete: this.initialLoadComplete
    };
  }
}

export default UniverseOptimizer;