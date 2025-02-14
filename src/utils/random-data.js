import batchingToposort from 'batching-toposort';

import { arrayToObject, unique } from './index';
import randomUtils, { getNumberArray } from './random-utils';

//--- Config variables ---//

const MAX_EDGE_COUNT = 200;
const MIN_EDGE_COUNT = 100;
const MAX_RANK_COUNT = 50;
const MIN_RANK_COUNT = 10;
const MAX_RANK_NODE_COUNT = 10;
const MIN_RANK_NODE_COUNT = 1;
const MIN_NODE_DEGREE = 2;
const MAX_NODE_TAG_COUNT = 5;
const MAX_TAG_COUNT = 20;
const PARAMETERS_FREQUENCY = 0.2;
const MIN_PIPELINES_COUNT = 2;
const MAX_PIPELINES_COUNT = 15;
const LAYERS = [
  'Raw',
  'Intermediate',
  'Primary',
  'Feature',
  'Model Input',
  'Model Output',
];

/**
 * Generate a random pipeline dataset
 */
class Pipeline {
  constructor() {
    this.utils = randomUtils();
    this.pipelines = this.generatePipelines();
    this.rankCount = this.getRankCount();
    this.rankLayers = this.getRankLayers();
    this.tags = this.generateTags();
    this.nodes = this.generateNodes();
    this.edges = this.generateEdges();
    this.modularPipelines = this.generateModularPipelines(this.nodes);

    this.update();
    this.finalise();
  }

  /**
   * Create the pipelines array
   * @returns {number} Rank count total
   */
  generatePipelines() {
    const pipelines = ['Default'];
    const pipelineCount = this.utils.randomNumberBetween(
      MIN_PIPELINES_COUNT,
      MAX_PIPELINES_COUNT
    );
    for (let i = 1; i < pipelineCount; i++) {
      pipelines.push(this.utils.getRandomName(this.utils.randomNumber(4), ' '));
    }
    return pipelines.filter(unique);
  }

  /**
   * Create the modular pipelines tree from nodes in the graph
   * @returns {Object} A modular pipelines tree
   */
  generateModularPipelines(nodes) {
    return {
      __root__: {
        id: '__root__',
        name: 'Root',
        children: nodes.map((node) => ({ id: node.id, type: node.type })),
      },
    };
  }

  /**
   * Get the number of ranks (i.e. horizontal bands)
   * Odd ranks are data, even are task
   * @returns {number} Rank count total
   */
  getRankCount() {
    let rankCount = this.utils.randomNumberBetween(
      MIN_RANK_COUNT,
      MAX_RANK_COUNT
    );
    // Ensure odd numbers only, so that we start and end with a data node
    if (!rankCount % 2) {
      rankCount += 1;
    }
    return rankCount;
  }

  /**
   * Randomly determine the layer for each rank
   * @returns {object} Layers by rank
   */
  getRankLayers() {
    const layerSize = arrayToObject(LAYERS, () => 0);
    // Randomly decide the number of ranks in each layer
    for (let i = 0; i < this.rankCount; i++) {
      layerSize[this.utils.getRandom(LAYERS)]++;
    }
    // Assign layers to ranks based on layerSize
    const rankLayers = {};
    for (let rank = 0, layer = 0; rank < this.rankCount; rank++) {
      while (layerSize[LAYERS[layer]] < 1) {
        layer++;
      }
      rankLayers[rank] = LAYERS[layer];
      layerSize[LAYERS[layer]]--;
    }
    return rankLayers;
  }

  /**
   * Generate a random list of tags
   * @returns {array} Tag name strings
   */
  generateTags() {
    const tagCount = this.utils.randomNumber(MAX_TAG_COUNT);
    return getNumberArray(tagCount)
      .map(() =>
        this.utils.getRandomName(this.utils.randomNumber(MAX_NODE_TAG_COUNT))
      )
      .filter(unique);
  }

  /**
   * Create list of nodes
   * @returns {array} List of node objects
   */
  generateNodes() {
    const nodes = [];
    for (let rank = 0; rank < this.rankCount; rank++) {
      const rankNodeCount = this.getRankNodeCount(rank);
      for (let i = 0; i < rankNodeCount; i++) {
        const node = this.createNode(i, rank);
        nodes.push(node);
      }
    }
    return nodes;
  }

  /**
   * Return a random count of nodes for a rank
   * @returns {number} rank node count
   */
  getRankNodeCount() {
    return Math.min(
      MIN_RANK_NODE_COUNT / this.utils.random(),
      MAX_RANK_NODE_COUNT
    );
  }

  /**
   * Determine a node's type based on its rank
   * @param {number} rank Rank number
   * @returns {string} Node type (task/data/parameters)
   */
  getType(node) {
    if (node.rank % 2) {
      return 'task';
    }

    if (!node._sources.length && this.utils.random() < PARAMETERS_FREQUENCY) {
      return 'parameters';
    }

    return 'data';
  }

  /**
   * Create a node datum object.
   * @param {number} i Node index within its rank
   * @param {number} initialRank Rank index
   * @returns {object} Node object
   */

  createNode(i, initialRank) {
    const layer = this.rankLayers[initialRank];
    const node = {
      id: `${layer}_${initialRank}_${i}`,
      name: null,
      full_name: null, //eslint-disable-line camelcase
      type: null,
      rank: initialRank,
      layer: layer,
      pipelines: this.getNodePipelines(),
      modular_pipelines: null, //eslint-disable-line camelcase
      tags: this.getRandomTags(),
      _sources: [],
      _targets: [],
    };
    return node;
  }

  /**
   * Create a new node name of up to 10 words
   * @param {string} Node type (task/data/parameters)
   * @returns {string} Node name
   */
  getNodeName(type) {
    const name = this.utils.getRandomName(this.utils.randomNumber(10), ' ');
    return type === 'parameters' ? `Parameters ${name}` : name;
  }

  /**
   * Generate node metadata panel info
   * @param {object} node A single node object
   */
  getNodeMetaData(node) {
    const { getRandomName, randomNumber } = this.utils;

    if (node.type === 'task') {
      node.code = this.generateCodeSnippet();
    } else if (node.type === 'data') {
      node.datasetType = getRandomName(randomNumber(2));
    }
    node.filepath = getRandomName(randomNumber(10), '/');
    node.parameters = arrayToObject(
      getNumberArray(randomNumber(10)).map(() =>
        getRandomName(randomNumber(2), '_')
      ),
      () => this.utils.randomNumber(50) / 10
    );
  }

  /**
   * Use one of the methods of this class as a code example
   */
  generateCodeSnippet() {
    const methods = Object.getOwnPropertyNames(Pipeline.prototype);
    const index = this.utils.randomIndex(methods.length);
    let code = Pipeline.prototype[methods[index]].toString();
    if (index > 0) {
      code = 'function ' + code.replace(/\n\s\s/g, '\n');
    }
    return code;
  }

  /**
   * Create a list of the pipelines that the node will be included in
   * @returns {array} Node piplines
   */
  getNodePipelines() {
    return this.pipelines.reduce((pipelines, id, i) => {
      if (i === 0 || this.utils.randomIndex(2)) {
        return pipelines.concat(id);
      }
      return pipelines;
    }, []);
  }

  /**
   * Select a random number of tags from the list of tags
   * @returns {array} List of tags
   */
  getRandomTags() {
    return this.utils.getRandomSelection(
      this.tags,
      this.utils.randomNumber(this.tags.length)
    );
  }

  /**
   * Gets a map of ranks to lists of nodes at that rank
   * @returns {array} List of nodes
   */
  getNodesByRank() {
    const nodesByRank = {};

    for (const node of this.nodes) {
      nodesByRank[node.rank] = nodesByRank[node.rank] || [];
      nodesByRank[node.rank].push(node);
    }

    return nodesByRank;
  }

  /**
   * Create list of edges
   * @returns {array} Edge objects
   */
  generateEdges() {
    const edges = [];
    const edgeCount = this.utils.randomNumberBetween(
      MIN_EDGE_COUNT,
      MAX_EDGE_COUNT
    );
    const nodesByRank = this.getNodesByRank();

    // Find the sorted list of node ranks
    const ranks = Object.keys(nodesByRank)
      .map((rank) => parseFloat(rank))
      .sort((a, b) => a - b);

    // Gets a random node with the given rank index
    const getRandomNodeAtRank = (rankIndex) => {
      const rankValue = ranks[rankIndex];
      const rankNodes = nodesByRank[rankValue];
      const rankNodeIndex = this.utils.randomIndex(rankNodes.length);
      return rankNodes[rankNodeIndex];
    };

    // For the desired amount of edges
    for (let i = 0; i < edgeCount; i += 1) {
      // Choose a random source node excluding the last rank
      const sourceRankIndex = this.utils.randomIndex(ranks.length - 1);
      const source = getRandomNodeAtRank(sourceRankIndex);

      // Choose a random target node after the source rank prefering nearby
      const remainingRankCount = ranks.length - 1 - sourceRankIndex;
      const biasedRandom = Math.round(0.5 / this.utils.random());
      const targetRankIndex =
        sourceRankIndex + Math.min(biasedRandom, remainingRankCount);
      const target = getRandomNodeAtRank(targetRankIndex);

      // Build the edge
      const edge = {
        source: source.id,
        target: target.id,
        _sourceNode: source,
        _targetNode: target,
      };

      edges.push(edge);

      // Keep track of edges on nodes for later convenience
      source._targets.push(edge);
      target._sources.push(edge);
    }

    return edges;
  }

  /**
   * Select only nodes with at least the minimum required connected nodes
   * @returns {object} Filtered nodes
   */
  activeNodes() {
    const nodes = {};

    // Gets the total number of edges for the given node
    const degree = (node) => node._sources.length + node._targets.length;

    for (const edge of this.edges) {
      // Keep both nodes if they have enough combined connections
      if (
        degree(edge._sourceNode) + degree(edge._targetNode) >
        MIN_NODE_DEGREE
      ) {
        nodes[edge._sourceNode.id] = edge._sourceNode;
        nodes[edge._targetNode.id] = edge._targetNode;
      }
    }

    return Object.values(nodes);
  }

  /**
   * Select only used tags
   * @returns {object} Filtered tags
   */
  activeTags() {
    return this.nodes
      .reduce((tags, node) => (node.tags ? tags.concat(node.tags) : tags), [])
      .filter(unique)
      .map((tag) => ({ name: tag, id: tag }));
  }

  /**
   * Select only used edges
   * @returns {object} Filtered edges
   */
  activeEdges() {
    const visibleNodes = arrayToObject(
      this.nodes.map((node) => node.id),
      () => true
    );

    return this.edges.filter(
      (edge) => visibleNodes[edge.target] && visibleNodes[edge.source]
    );
  }

  /**
   * Updates node properties including rank, type and name based on the current graph
   */
  update() {
    const graph = {};

    for (const node of this.nodes) {
      graph[node.id] = [];
    }

    for (const edge of this.edges) {
      graph[edge.source].push(edge.target);
    }

    // Use toposort to find actual ranks
    const sortedNodes = batchingToposort(graph);

    for (let rank = 0; rank < sortedNodes.length; rank++) {
      for (const id of sortedNodes[rank]) {
        const node = this.nodes.find((node) => node.id === id);
        node.rank = rank;
        node.type = this.getType(node);
        node.name = this.getNodeName(node.type);
        node.full_name =  //eslint-disable-line camelcase
        `${node.layer}_${node.type}_${node.rank}_${node.name}`.replace(
          /\s/g,
          '_'
        );
        this.getNodeMetaData(node);
      }
    }
  }

  /**
   * Removes unused elements and cleans up temporary properties
   */
  finalise() {
    this.nodes = this.activeNodes();
    this.tags = this.activeTags();
    this.edges = this.activeEdges();

    for (const node of this.nodes) {
      delete node._sources;
      delete node._targets;
    }

    for (const edge of this.edges) {
      delete edge._targetNode;
      delete edge._sourceNode;
    }
  }

  /**
   * Gets the complete pipeline data
   * @returns {object} The pipeline data
   */
  all() {
    return {
      edges: this.edges,
      layers: LAYERS,
      nodes: this.nodes,
      pipelines: this.pipelines.map((name) => ({ id: name, name })),
      //eslint-disable-next-line camelcase
      modular_pipelines: this.modularPipelines,
      tags: this.tags,
    };
  }
}

const generateRandomPipeline = () => new Pipeline().all();

export default generateRandomPipeline;
