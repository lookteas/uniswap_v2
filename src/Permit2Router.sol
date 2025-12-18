// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Permit2 SignatureTransfer 接口
interface IPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct PermitBatchTransferFrom {
        TokenPermissions[] permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    function permitTransferFrom(
        PermitBatchTransferFrom calldata permit,
        SignatureTransferDetails[] calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

// Uniswap V2 Router 接口
interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

// Uniswap V2 Factory 接口
interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/// @title Permit2Router
/// @notice 包装合约，通过 Permit2 实现一笔交易完成授权+添加流动性
contract Permit2Router {
    // Permit2 官方合约地址（所有链相同）
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // Uniswap V2 Router
    IUniswapV2Router02 public immutable router;
    IUniswapV2Factory public immutable factory;

    constructor(address _router, address _factory) {
        router = IUniswapV2Router02(_router);
        factory = IUniswapV2Factory(_factory);
    }

    /// @notice 通过 Permit2 签名添加流动性（使用结构体减少参数）
    struct AddLiquidityParams {
        address tokenA;
        address tokenB;
        uint256 amountA;
        uint256 amountB;
        uint256 amountAMin;
        uint256 amountBMin;
        address to;
        uint256 deadline;
    }

    struct Permit2Params {
        uint256 nonceA;
        uint256 nonceB;
        bytes signatureA;
        bytes signatureB;
    }

    struct Permit2BatchParams {
        uint256 nonce;
        bytes signature;
    }

    function addLiquidityWithPermit2(
        AddLiquidityParams calldata params,
        Permit2Params calldata permit2
    ) external returns (uint256 amountAActual, uint256 amountBActual, uint256 liquidity) {
        // 通过 Permit2 转移代币到本合约
        _permit2Transfer(params.tokenA, params.amountA, permit2.nonceA, params.deadline, permit2.signatureA);
        _permit2Transfer(params.tokenB, params.amountB, permit2.nonceB, params.deadline, permit2.signatureB);

        // 授权给 Router
        IERC20(params.tokenA).approve(address(router), params.amountA);
        IERC20(params.tokenB).approve(address(router), params.amountB);

        // 添加流动性
        (amountAActual, amountBActual, liquidity) = router.addLiquidity(
            params.tokenA,
            params.tokenB,
            params.amountA,
            params.amountB,
            params.amountAMin,
            params.amountBMin,
            params.to,
            params.deadline
        );

        // 退还多余的代币
        _refundRemaining(params.tokenA);
        _refundRemaining(params.tokenB);
    }

    function addLiquidityWithPermit2Batch(
        AddLiquidityParams calldata params,
        Permit2BatchParams calldata permit2
    ) external returns (uint256 amountAActual, uint256 amountBActual, uint256 liquidity) {
        IPermit2.TokenPermissions[] memory permitted = new IPermit2.TokenPermissions[](2);
        permitted[0] = IPermit2.TokenPermissions({ token: params.tokenA, amount: params.amountA });
        permitted[1] = IPermit2.TokenPermissions({ token: params.tokenB, amount: params.amountB });

        IPermit2.SignatureTransferDetails[] memory details = new IPermit2.SignatureTransferDetails[](2);
        details[0] = IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: params.amountA });
        details[1] = IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: params.amountB });

        IPermit2(PERMIT2).permitTransferFrom(
            IPermit2.PermitBatchTransferFrom({ permitted: permitted, nonce: permit2.nonce, deadline: params.deadline }),
            details,
            msg.sender,
            permit2.signature
        );

        IERC20(params.tokenA).approve(address(router), params.amountA);
        IERC20(params.tokenB).approve(address(router), params.amountB);

        (amountAActual, amountBActual, liquidity) = router.addLiquidity(
            params.tokenA,
            params.tokenB,
            params.amountA,
            params.amountB,
            params.amountAMin,
            params.amountBMin,
            params.to,
            params.deadline
        );

        _refundRemaining(params.tokenA);
        _refundRemaining(params.tokenB);
    }

    function _permit2Transfer(
        address token,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal {
        if (signature.length == 0) return;

        IPermit2(PERMIT2).permitTransferFrom(
            IPermit2.PermitTransferFrom({
                permitted: IPermit2.TokenPermissions({ token: token, amount: amount }),
                nonce: nonce,
                deadline: deadline
            }),
            IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: amount }),
            msg.sender,
            signature
        );
    }

    function _refundRemaining(address token) internal {
        uint256 remaining = IERC20(token).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(token).transfer(msg.sender, remaining);
        }
    }

    /// @notice 通过 Permit2 签名进行 Swap
    struct SwapParams {
        uint256 amountIn;
        uint256 amountOutMin;
        address[] path;
        address to;
        uint256 deadline;
    }

    struct Permit2SingleParams {
        uint256 nonce;
        bytes signature;
    }

    function swapWithPermit2(
        SwapParams calldata params,
        Permit2SingleParams calldata permit2
    ) external returns (uint256[] memory amounts) {
        address tokenIn = params.path[0];
        
        // 通过 Permit2 转移输入代币到本合约
        _permit2Transfer(tokenIn, params.amountIn, permit2.nonce, params.deadline, permit2.signature);

        // 授权给 Router
        IERC20(tokenIn).approve(address(router), params.amountIn);

        // 执行 Swap
        amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
        );

        // 退还可能剩余的输入代币
        _refundRemaining(tokenIn);
    }

    /// @notice 通过 Permit2 签名移除流动性
    struct RemoveLiquidityParams {
        address tokenA;
        address tokenB;
        uint256 liquidity;
        uint256 amountAMin;
        uint256 amountBMin;
        address to;
        uint256 deadline;
    }

    function removeLiquidityWithPermit2(
        RemoveLiquidityParams calldata params,
        Permit2SingleParams calldata permit2
    ) external returns (uint256 amountA, uint256 amountB) {
        // 获取 LP Token 地址
        address pair = factory.getPair(params.tokenA, params.tokenB);
        require(pair != address(0), "Pair does not exist");

        // 通过 Permit2 转移 LP Token 到本合约
        _permit2Transfer(pair, params.liquidity, permit2.nonce, params.deadline, permit2.signature);

        // 授权 LP Token 给 Router
        IERC20(pair).approve(address(router), params.liquidity);

        // 移除流动性
        (amountA, amountB) = router.removeLiquidity(
            params.tokenA,
            params.tokenB,
            params.liquidity,
            params.amountAMin,
            params.amountBMin,
            params.to,
            params.deadline
        );
    }
}
