// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "forge-std/Script.sol";
import "../src/Permit2Router.sol";

contract DeployPermit2Router is Script {
    // Uniswap V2 合约地址（Sepolia）
    address constant ROUTER02 = 0x3c66Fe68778281be4358F21BfB63aE9cD242aB58;
    address constant FACTORY = 0x9A267db279FE7d11138f9293784460Df577c3198;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Permit2Router permit2Router = new Permit2Router(ROUTER02, FACTORY);
        
        console.log("Permit2Router deployed at:", address(permit2Router));
        
        vm.stopBroadcast();
    }
}
