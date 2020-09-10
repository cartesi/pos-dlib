// Copyright (C) 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: GPL-3.0-only
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Note: This component currently has dependencies that are licensed under the GNU
// GPL, version 3, and so you should treat this component as a whole as being under
// the GPL version 3. But all Cartesi-written code in this component is licensed
// under the Apache License, version 2, or a compatible permissive license, and can
// be used independently under the Apache v2 license. After this component is
// rewritten, the entire component will be released under the Apache v2 license.


/// @title Interface staking contract
pragma solidity ^0.7.0;

interface Staking {

    /// @notice Returns total amount of tokens counted as stake
    /// @param _userAddress user to retrieve staked balance from
    /// @return finalized staked of _userAddress
    function getStakedBalance(
        address _userAddress) external view returns (uint256);

    /// @notice Returns the timestamp when next deposit can be finalized
    /// @return timestamp of when finalizeStakes() is callable
    function getFinalizeDepositTimestamp(address _userAddress) external view returns (uint256);

    /// @notice Returns the timestamp when next withdraw can be finalized
    /// @return timestamp of when finalizeWithdraw() is callable
    function getFinalizeWithdrawTimestamp(address _userAddress) external view returns (uint256);


    /// @notice Returns the amount of money to be deposited after finalization
    /// @return amount that will get staked after finalization
    function getUnfinalizedDepositAmount(address _userAddress) external view  returns (uint256);

    /// @notice Returns the amount of money to be withdrew after finalization
    /// @return amount that will get withdrew after finalization
    function getUnfinalizedWithdrawAmount(address _userAddress) external view  returns (uint256);


    /// @notice Deposit CTSI to be staked. The money will turn into staked
    ///         balance after timeToStake days, if the function finalizeStakes
    ///         is called.
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _amount) external;

    /// @notice Transforms msg.sender mature deposits into staked tokens.
    function finalizeStakes() external;

    /// @notice Start CTSI withdraw from staked balance process. The money will
    ///         turn into withdrawal balance after timeToWithdraw days, if the
    ///         function finalizeWithdraw is called.
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _amount) external;

    /// @notice Finalizes msg.sender mature withdraws.
    function finalizeWithdraws() external;

    // events
    /// @notice CTSI tokens were deposited as a Stake, can be finalized after _maturationDate
    /// @param _amount amount deposited for staking
    /// @param _address address of msg.sender
    /// @param _maturationDate date when the stake can be finalized
    event StakeDeposited(
        uint256 indexed _amount,
        address indexed _address,
        uint256 indexed _maturationDate
    );

    /// @notice Stake was finalized, effectively counting for the PoS now
    /// @param _amount total amount staked for that msg.sender
    /// @param _address address of msg.sender
    event StakeFinalized(
        uint256 indexed _amount,
        address indexed _address
    );

    /// @notice Withdraw process has started, tokens will be freed after _maturationDate
    /// @param _amount amount of tokens for that withdraw request
    /// @param _address address of msg.sender
    /// @param _maturationDate date when the withdraw can be finalized
    event WithdrawStarted(
        uint256 indexed _amount,
        address indexed _address,
        uint256 indexed _maturationDate
    );

    /// @notice Withdraw process was finalized
    /// @param _amount amount of tokens withdrawn
    /// @param _address address of msg.sender
    event WithdrawFinalized(
        uint256 indexed _amount,
        address indexed _address
    );
}

