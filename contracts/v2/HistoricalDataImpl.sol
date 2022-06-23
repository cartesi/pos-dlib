// Copyright 2022 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

/// @title HistoricalData

pragma solidity ^0.8.0;

import "@cartesi/tree/contracts/Tree.sol";
import "./abstracts/AHistoricalData.sol";

contract HistoricalDataImpl is AHistoricalData {
    using Tree for Tree.TreeCtx;

    struct BlockData {
        address producer;
        uint32 mainchainBlockNumber;
        bytes32 dataHash;
    }

    struct HistoricalCtx {
        address lastProducer;
        uint32 ethBlockStamp;
        uint32 sidechainBlockCount;
        Tree.TreeCtx tree;
        mapping(uint256 => BlockData) blockData;
    }

    HistoricalCtx historicalCtx;

    /// @notice Record block data produced from PoS contract
    /// @param _parent the parent block that current block appends to
    /// @param _producer the producer of the sidechain block
    /// @param _dataHash hash of the data held by the block
    function recordBlock(
        uint256 _parent,
        address _producer,
        bytes32 _dataHash
    ) internal override returns (uint256) {
        uint256 sidechainBlockNumber = historicalCtx.tree.insertVertex(_parent);
        historicalCtx.blockData[sidechainBlockNumber] = BlockData(
            _producer,
            uint32(block.number),
            _dataHash
        );

        ++historicalCtx.sidechainBlockCount;
        historicalCtx.lastProducer = _producer;
        historicalCtx.ethBlockStamp = uint32(block.number);

        return sidechainBlockNumber;
    }

    /// @notice Validate a sidechain block
    /// @param _sidechainBlockNumber the sidechain block number to validate
    /// @param _depthDiff the minimal depth diff to validate sidechain block
    /// @return bool is the sidechain block valid
    /// @return address the producer of the sidechain block
    function isValidBlock(uint256 _sidechainBlockNumber, uint256 _depthDiff)
        external
        view
        override
        returns (bool, address)
    {
        uint256 blockDepth = historicalCtx.tree.getDepth(_sidechainBlockNumber);
        (uint256 deepestBlock, uint256 deepestDepth) = historicalCtx
        .tree
        .getDeepest();

        if (
            historicalCtx.tree.getAncestorAtDepth(deepestBlock, blockDepth) !=
            _sidechainBlockNumber
        ) {
            return (false, address(0));
        } else if (deepestDepth - blockDepth >= _depthDiff) {
            return (
                true,
                historicalCtx.blockData[_sidechainBlockNumber].producer
            );
        } else {
            return (false, address(0));
        }
    }
}
