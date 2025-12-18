// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/TestToken.sol";

/**
 * @title DeployTokens
 * @dev 部署 1 个测试代币 (TKA, TKB, TKC, TKD)
 * 
 * 使用方法:
 * forge script script/DeploySingelTokens.s.sol:DeploySingleToken --rpc-url $SEPOLIA_RPC_URL --broadcast
 */
contract DeploySingleToken is Script {
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 10**18;

    uint256 constant MAX_SUPPLY = 0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory name_ = "Token E";
        string memory symbol_ = "TKE";

        console.log("Deployer address:", deployer);
        console.log("TOKEN_NAME:", name_);
        console.log("TOKEN_SYMBOL:", symbol_);
        console.log("Initial supply per token:", INITIAL_SUPPLY / 10**18, "tokens");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        TestToken token = new TestToken(name_, symbol_, INITIAL_SUPPLY, MAX_SUPPLY);
        console.log("Token deployed at:", address(token));

        vm.stopBroadcast();

        console.log("");
        console.log("All tokens support ERC-2612 Permit!");
    }
}
