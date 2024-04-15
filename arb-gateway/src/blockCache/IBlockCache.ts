/**
 * Interface for a block cache.
 */
export interface IBlockCache {
  /**
   * Retrieves a block from the cache.
   * @param nodeIndex The index of the node.
   * @returns A promise that resolves to the retrieved block, or null if the block is not found.
   */
  getBlock(nodeIndex: bigint): Promise<{
    nodeIndex: bigint;
    block: Record<string, string>;
    sendRoot: string;
  } | null>;

  /**
   * Sets a block in the cache.
   * @param nodeIndex The index of the node.
   * @param block The block data to be stored.
   * @param sendRoot The send root associated with the block.
   * @returns A promise that resolves when the block is successfully set in the cache.
   */
  setBlock(
    nodeIndex: bigint,
    block: Record<string, string>,
    sendRoot: string
  ): Promise<void>;
}
