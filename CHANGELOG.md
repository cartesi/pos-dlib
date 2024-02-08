# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2024-02-08

### Added

- Add sepolia network

### Removed

- Removed deployments of avax_testnet, bsc_testnet, optimism_goerli, polygon_mumbai, rinkeby and ropsten

## [2.0.0] - 2022-11-15

### Changed

- PoSV2 smart contracts

## [1.1.2] - 2021-06-29

### Changed

- Ropsten Staking with same mainnet maturation period

## [1.1.1] - 2021-06-29

### Added

- Interfaces compatible with solidity 0.8
- Deployment to ropsten

## [1.1.0] - 2021-02-26

### Changed

- Changed target interval from elapsed time to number of blocks
- Reduced gas of block production by 23%
- Reduced race conditions in some edge cases
- Improved revert message in some cases of race conditions

## [1.0.0] - 2020-12-24

- First release

[unreleased]: https://github.com/cartesi/pos-dlib/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/cartesi/pos-dlib/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/cartesi/pos-dlib/compare/v1.1.2...v2.0.0
[1.1.2]: https://github.com/cartesi/pos-dlib/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/cartesi/pos-dlib/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/cartesi/pos-dlib/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/cartesi/pos-dlib/releases/tag/v1.0.0
