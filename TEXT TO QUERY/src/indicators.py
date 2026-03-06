"""
Technical Analysis Indicators Module

Pure Python implementation of common TA indicators (RSI, EMA, MACD, etc.)
No external TA library dependencies - works with standard library only.
"""

from typing import Any


def _calculate_ema(values: list[float], period: int) -> list[float | None]:
    """Calculate Exponential Moving Average."""
    if len(values) < period:
        return [None] * len(values)
    
    multiplier = 2 / (period + 1)
    ema_values = [None] * (period - 1)  # First (period-1) values are None
    
    # First EMA is SMA
    sma = sum(values[:period]) / period
    ema_values.append(sma)
    
    # Calculate subsequent EMAs
    prev_ema = sma
    for i in range(period, len(values)):
        ema = (values[i] - prev_ema) * multiplier + prev_ema
        ema_values.append(ema)
        prev_ema = ema
    
    return ema_values


def _calculate_rsi(values: list[float], period: int = 14) -> list[float | None]:
    """Calculate Relative Strength Index."""
    if len(values) < period + 1:
        return [None] * len(values)
    
    rsi_values = [None]  # First value is None (no change)
    
    # Calculate price changes
    changes = [values[i] - values[i-1] for i in range(1, len(values))]
    
    # Calculate initial averages
    gains = [max(0, c) for c in changes[:period]]
    losses = [abs(min(0, c)) for c in changes[:period]]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    # First RSI
    if avg_loss == 0:
        rsi_values.append(100.0)
    else:
        rs = avg_gain / avg_loss
        rsi_values.append(100 - (100 / (1 + rs)))
    
    # Calculate subsequent RSIs using smoothed averages
    for i in range(period, len(changes)):
        gain = max(0, changes[i])
        loss = abs(min(0, changes[i]))
        
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        
        if avg_loss == 0:
            rsi_values.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(100 - (100 / (1 + rs)))
    
    return rsi_values


def _calculate_macd(values: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """Calculate MACD line, signal line, and histogram."""
    if len(values) < slow + signal:
        return ([None] * len(values), [None] * len(values), [None] * len(values))
    
    # Calculate EMAs for MACD
    ema_fast = _calculate_ema(values, fast)
    ema_slow = _calculate_ema(values, slow)
    
    # MACD line = EMA(fast) - EMA(slow)
    macd_line = []
    for i in range(len(values)):
        if ema_fast[i] is None or ema_slow[i] is None:
            macd_line.append(None)
        else:
            macd_line.append(ema_fast[i] - ema_slow[i])
    
    # Signal line = EMA(MACD, signal)
    # Filter out None values for signal calculation
    valid_macd = [(i, v) for i, v in enumerate(macd_line) if v is not None]
    if len(valid_macd) < signal:
        signal_line = [None] * len(values)
        histogram = [None] * len(values)
        return (macd_line, signal_line, histogram)
    
    macd_values_only = [v for _, v in valid_macd]
    signal_ema = _calculate_ema(macd_values_only, signal)
    
    # Map signal back to original indices
    signal_line = [None] * len(values)
    for idx, (orig_idx, _) in enumerate(valid_macd):
        if idx < len(signal_ema) and signal_ema[idx] is not None:
            signal_line[orig_idx] = signal_ema[idx]
    
    # Histogram = MACD - Signal
    histogram = []
    for i in range(len(values)):
        if macd_line[i] is None or signal_line[i] is None:
            histogram.append(None)
        else:
            histogram.append(macd_line[i] - signal_line[i])
    
    return (macd_line, signal_line, histogram)


def _calculate_bbands(values: list[float], period: int = 20, std_dev: int = 2) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """Calculate Bollinger Bands (upper, middle, lower)."""
    if len(values) < period:
        return ([None] * len(values), [None] * len(values), [None] * len(values))
    
    upper = [None] * (period - 1)
    middle = [None] * (period - 1)
    lower = [None] * (period - 1)
    
    import statistics
    
    for i in range(period - 1, len(values)):
        window = values[i - period + 1:i + 1]
        sma = sum(window) / period
        std = statistics.stdev(window)
        
        upper.append(sma + (std_dev * std))
        middle.append(sma)
        lower.append(sma - (std_dev * std))
    
    return (upper, middle, lower)


def _calculate_stoch_rsi(values: list[float], rsi_period: int = 14, stoch_period: int = 14) -> tuple[list[float | None], list[float | None]]:
    """Calculate Stochastic RSI (%K and %D)."""
    rsi_values = _calculate_rsi(values, rsi_period)
    
    # Filter valid RSI values
    valid_indices = [i for i, v in enumerate(rsi_values) if v is not None]
    if len(valid_indices) < stoch_period:
        return ([None] * len(values), [None] * len(values))
    
    k_values = [None] * len(values)
    
    for i in range(stoch_period - 1, len(valid_indices)):
        window_start = valid_indices[i - stoch_period + 1]
        window_end = valid_indices[i] + 1
        window = [rsi_values[j] for j in range(window_start, window_end) if rsi_values[j] is not None]
        
        if len(window) < stoch_period:
            continue
        
        min_rsi = min(window)
        max_rsi = max(window)
        current_rsi = rsi_values[valid_indices[i]]
        
        if max_rsi == min_rsi:
            stoch_rsi = 50.0
        else:
            stoch_rsi = (current_rsi - min_rsi) / (max_rsi - min_rsi) * 100
        
        k_values[valid_indices[i]] = stoch_rsi
    
    # %D is 3-period SMA of %K
    valid_k = [v for v in k_values if v is not None]
    if len(valid_k) < 3:
        return (k_values, [None] * len(values))
    
    d_sma = []
    for i in range(2, len(valid_k)):
        d_sma.append(sum(valid_k[i-2:i+1]) / 3)
    
    d_values = [None] * len(values)
    valid_k_indices = [i for i, v in enumerate(k_values) if v is not None]
    for i, d_val in enumerate(d_sma):
        if i + 2 < len(valid_k_indices):
            d_values[valid_k_indices[i + 2]] = d_val
    
    return (k_values, d_values)


def enrich_snapshots_with_indicators(snapshots: list[dict]) -> list[dict]:
    """
    Enrich snapshot list with technical indicators.
    
    Calculates: RSI, EMA (multiple periods), MACD, Bollinger Bands
    and adds them as fields to each snapshot.
    
    Args:
        snapshots: List of snapshot dicts with 'time', 'price_up', 'price_down', 'btc_price'
    
    Returns:
        New list of snapshots with added indicator fields
    """
    if not snapshots or len(snapshots) < 14:  # Minimum for RSI(14)
        return [dict(s) for s in snapshots]
    
    # Extract price series
    price_up_values = []
    btc_price_values = []
    
    for s in snapshots:
        try:
            price_up_values.append(float(s.get("price_up") or 0))
        except (TypeError, ValueError):
            price_up_values.append(0.0)
        
        try:
            btc_price_values.append(float(s.get("btc_price") or 0))
        except (TypeError, ValueError):
            btc_price_values.append(0.0)
    
    # Calculate indicators for price_up
    rsi_14 = _calculate_rsi(price_up_values, 14)
    rsi_7 = _calculate_rsi(price_up_values, 7)
    
    ema_9 = _calculate_ema(price_up_values, 9)
    ema_12 = _calculate_ema(price_up_values, 12)
    ema_20 = _calculate_ema(price_up_values, 20)
    ema_26 = _calculate_ema(price_up_values, 26)
    ema_50 = _calculate_ema(price_up_values, 50) if len(price_up_values) >= 50 else [None] * len(price_up_values)
    
    macd_line, macd_signal, macd_hist = _calculate_macd(price_up_values, 12, 26, 9)
    
    bb_upper, bb_middle, bb_lower = _calculate_bbands(price_up_values, 20, 2)
    
    stoch_k, stoch_d = _calculate_stoch_rsi(price_up_values, 14, 14)
    
    # Calculate BTC-based indicators
    btc_rsi = _calculate_rsi(btc_price_values, 14) if len(btc_price_values) >= 14 else [None] * len(snapshots)
    btc_ema_9 = _calculate_ema(btc_price_values, 9)
    btc_ema_12 = _calculate_ema(btc_price_values, 12)
    btc_ema_20 = _calculate_ema(btc_price_values, 20)
    
    # Build result with indicators
    result = []
    for i, s in enumerate(snapshots):
        snapshot = dict(s)
        
        # Price-based indicators
        snapshot["rsi"] = rsi_14[i] if i < len(rsi_14) else None
        snapshot["rsi_7"] = rsi_7[i] if i < len(rsi_7) else None
        snapshot["ema_9"] = ema_9[i] if i < len(ema_9) else None
        snapshot["ema_12"] = ema_12[i] if i < len(ema_12) else None
        snapshot["ema_20"] = ema_20[i] if i < len(ema_20) else None
        snapshot["ema_26"] = ema_26[i] if i < len(ema_26) else None
        snapshot["ema_50"] = ema_50[i] if i < len(ema_50) else None
        snapshot["macd"] = macd_line[i] if i < len(macd_line) else None
        snapshot["macd_signal"] = macd_signal[i] if i < len(macd_signal) else None
        snapshot["macd_hist"] = macd_hist[i] if i < len(macd_hist) else None
        snapshot["bb_upper"] = bb_upper[i] if i < len(bb_upper) else None
        snapshot["bb_middle"] = bb_middle[i] if i < len(bb_middle) else None
        snapshot["bb_lower"] = bb_lower[i] if i < len(bb_lower) else None
        snapshot["stoch_rsi_k"] = stoch_k[i] if i < len(stoch_k) else None
        snapshot["stoch_rsi_d"] = stoch_d[i] if i < len(stoch_d) else None
        
        # BTC-based indicators
        snapshot["btc_rsi"] = btc_rsi[i] if i < len(btc_rsi) else None
        snapshot["btc_ema_9"] = btc_ema_9[i] if i < len(btc_ema_9) else None
        snapshot["btc_ema_12"] = btc_ema_12[i] if i < len(btc_ema_12) else None
        snapshot["btc_ema_20"] = btc_ema_20[i] if i < len(btc_ema_20) else None
        
        result.append(snapshot)
    
    return result


def get_available_indicators() -> list[str]:
    """Return list of available indicator field names."""
    return [
        'rsi', 'rsi_7', 'stoch_rsi_k', 'stoch_rsi_d',
        'ema_9', 'ema_12', 'ema_20', 'ema_26', 'ema_50',
        'macd', 'macd_signal', 'macd_hist',
        'bb_upper', 'bb_middle', 'bb_lower',
        'btc_rsi', 'btc_ema_9', 'btc_ema_12', 'btc_ema_20'
    ]


def get_indicator_info(indicator_name: str) -> dict[str, Any]:
    """Get information about a specific indicator."""
    info_map = {
        'rsi': {'name': 'Relative Strength Index', 'range': '0-100', 'default_period': 14, 'description': 'Momentum oscillator, 70+ overbought, 30- oversold'},
        'rsi_7': {'name': 'RSI (7-period)', 'range': '0-100', 'default_period': 7, 'description': 'Short-term RSI'},
        'ema_9': {'name': 'EMA (9)', 'range': 'price-based', 'default_period': 9, 'description': '9-period Exponential Moving Average'},
        'ema_12': {'name': 'EMA (12)', 'range': 'price-based', 'default_period': 12, 'description': '12-period Exponential Moving Average'},
        'ema_20': {'name': 'EMA (20)', 'range': 'price-based', 'default_period': 20, 'description': '20-period Exponential Moving Average'},
        'ema_26': {'name': 'EMA (26)', 'range': 'price-based', 'default_period': 26, 'description': '26-period Exponential Moving Average'},
        'ema_50': {'name': 'EMA (50)', 'range': 'price-based', 'default_period': 50, 'description': '50-period Exponential Moving Average'},
        'macd': {'name': 'MACD Line', 'range': 'unbounded', 'default_period': '12/26/9', 'description': 'MACD main line'},
        'macd_signal': {'name': 'MACD Signal', 'range': 'unbounded', 'default_period': '12/26/9', 'description': 'MACD signal line (9-period EMA of MACD)'},
        'macd_hist': {'name': 'MACD Histogram', 'range': 'unbounded', 'default_period': '12/26/9', 'description': 'MACD - Signal, positive=bullish'},
        'bb_upper': {'name': 'Bollinger Upper Band', 'range': 'price-based', 'default_period': 20, 'description': 'Upper Bollinger Band (20-period SMA + 2 std)'},
        'bb_lower': {'name': 'Bollinger Lower Band', 'range': 'price-based', 'default_period': 20, 'description': 'Lower Bollinger Band (20-period SMA - 2 std)'},
        'stoch_rsi_k': {'name': 'Stochastic RSI %K', 'range': '0-100', 'default_period': 14, 'description': 'Stochastic RSI fast line'},
        'stoch_rsi_d': {'name': 'Stochastic RSI %D', 'range': '0-100', 'default_period': 14, 'description': 'Stochastic RSI slow line'},
        'btc_rsi': {'name': 'BTC RSI', 'range': '0-100', 'default_period': 14, 'description': 'RSI calculated on BTC price'},
    }
    return info_map.get(indicator_name, {'name': indicator_name, 'description': 'Technical indicator'})
