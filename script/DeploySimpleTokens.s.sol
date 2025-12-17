// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/SimpleToken.sol";

/**
 * @title DeploySimpleTokens
 * @dev 部署 4 个简化版测试代币 (TKA, TKB, TKC, TKD)
 * 
 * 使用方法:
 * forge script script/DeploySimpleTokens.s.sol:DeploySimpleTokens --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeploySimpleTokens is Script {
    // 每个代币的初始供应量: 1,000,000 tokens
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 10**18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Initial supply per token:", INITIAL_SUPPLY / 10**18, "tokens");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 部署 TKA
        SimpleToken tokenA = new SimpleToken("Token A", "TKA", INITIAL_SUPPLY);
        console.log("TKA deployed at:", address(tokenA));

        // 部署 TKB
        SimpleToken tokenB = new SimpleToken("Token B", "TKB", INITIAL_SUPPLY);
        console.log("TKB deployed at:", address(tokenB));

        // 部署 TKC
        SimpleToken tokenC = new SimpleToken("Token C", "TKC", INITIAL_SUPPLY);
        console.log("TKC deployed at:", address(tokenC));

        // 部署 TKD
        SimpleToken tokenD = new SimpleToken("Token D", "TKD", INITIAL_SUPPLY);
        console.log("TKD deployed at:", address(tokenD));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("TKA:", address(tokenA));
        console.log("TKB:", address(tokenB));
        console.log("TKC:", address(tokenC));
        console.log("TKD:", address(tokenD));
    }
}
