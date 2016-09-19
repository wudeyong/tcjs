/**
 * @author galenye
 */
define(function(require, exports, module) {
	var widgets = {}



	/* 用于计算器 start */

	/**
	 * 计算官网价格
	 * @param type 类型 bandwidth/flux 
	 * @param val 值 单位是Mbps/GB
	 * @return {[Number]}
	 */

	widgets.calculate = function(type, val) {
		var res;
		/**
		 *  设当月CDN流量X TB，当月CDN流量结算费用为Y：
		 *  当 X < 2，Y = X*1000*0.34
		 *  当 2 ≦ X < 10， Y = 2*1000*0.34 + (X-2) *1000*0.32
		 *  当 10 ≦ X < 50， Y = 2*1000*0.34 +8 *1000*0.32 + (X-10) *1000*0.3
		 *  当 X ≧ 50， Y = 2*1000*0.34 + 8 *1000*0.32 +40 *1000*0.3 + (X-50) *1000*0.28
		 *  流量是阶梯累进计算的  
		**/
		/**
		 * 设当月CDN日带宽峰值平均值为X Mbps，当月CDN使用的有效天数为Y，当月CDN带宽结算费用为Z
		 * 当 X < 512，Z = X *1.1 *Y 
		 * 当 512 ≦ X < 5120， Z = [ X*1.0 ] *Y 
		 * 当 X ≧ 5120， Z = [ X*0.9 ] * Y
		 * 带宽是阶梯到达计算的
		 */ 
		if(type === 'flux') {
		    if(val<=0){
		        res = 0;
		    }else if(val<=0.02564){
		        res = 0.01;
		    }else if(val<2000){
		        res = val*0.34;
		    }else if(val>=2000 && val< 10*1000){
		        res = 2000*0.34 + (val-2000)*0.32;
		    }else if(val>= 10*1000 && val< 50*1000){
		        res = 2000*0.34 + 8*1000*0.32 + (val-10*1000)*0.3;
		    }else if(val>= 50*1000 && val< 100*1000){
		        res = 2000*0.34 + 8*1000*0.32 + 40*1000*0.3 + (val-50*1000)*0.28;
		    }else{
		        res = 2000*0.34 + 8*1000*0.32 + 40*1000*0.3 + (50*1000)*0.28 + (val-100*1000)*0.25;
		    }
		    res = res.toFixed(2);

		    //流量费用≤0.01元（1分钱），即所用流量≤0.02564GB≈26.256KB 时 收1分钱，无最大消费限制；
		    if(val>0 && res==0){
		        res = 0.01;
		    }
		}else {
			if(val<=0){
			    res = 0;
			}else if(val<500){
			    res = val*1.1 * 1;
			}else if(val>=500 && val<5000){
			    res = val*1 * 1;
			}else if(val>=5000 && val<50000){
			    res = val*0.9 * 1;
			}else if(val>=50000){
			    res = val*0.74 * 1;
			}

			res = res.toFixed(2);
		}

		return res;
	}





	/* 常用于图表 */

	/**
	 * 转成其他单位
	 * @parma type 类型 bandwidth/flux
	 * @param value 数值 单位是Byte/bps
	 * @param precision 精确度 默认是2，即保留两位
	 * @return String 如123GB
	 */
	widgets.changeUnit = function(type, value, precision, date) {
	    var unit;
	    var rate = 1000;
	    if(type === 'flux') {
	        unit = ['Byte', 'KB', 'MB', 'GB', 'TB', 'PB'];
	    }else {
	        unit = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps'];
	    }
	    if (!date) {
	    	date = new Date();
	    }
	    else {
	    	date = new Date(date + " 00:00:00");
	    }
	    if (date.getTime() < 1472659200000)
	    {
	    	rate = 1024;
	    }
	    while (value > rate) {
	        value /= rate;
	        unit.shift();
	    }

	    // precision = precision || (unit.length <= 3 ? 1000 : 10);
	    precision = Math.pow(10, precision || 2);
	    value = Math.round(value * precision) / precision;
	    var unit = unit.shift();
	    return {
	    	str: value + unit,
	    	num: value,
	    	unit: unit
	    }
	}

	/**
	 * 把单位是Byte/bps的数字转换成指定单位对应的数字
	 * @parma unit 单位 指定的单位
	 * @param value 数值 单位是Byte/bps
	 * @param Number
	 */
	widgets.byteToRightNum = function(unit, v, date) {
	    if(v === null) {
	        return v
	    }
	    var rate = 1000;
	    if (!date) {
	    	date = new Date();
	    }
	    else {
	    	date = new Date(date + " 00:00:00");
	    }
	    if (date.getTime() < 1472659200000)
	    {
	    	rate = 1024;
	    }

	    var obj = {
	        "TB" : (v / Math.pow(rate,4)),
	        "GB" : (v / Math.pow(rate,3)),
	        "MB" : (v / Math.pow(rate,2)),
	        "KB" : (v / Math.pow(rate,1)),
	        "Byte" : (v / Math.pow(rate,0)),
	        "Tbps" : (v / Math.pow(rate,4)),
	        "Gbps" : (v / Math.pow(rate,3)),
	        "Mbps" : (v / Math.pow(rate,2)),
	        "Kbps" : (v / Math.pow(rate,1)),
	        "bps" : (v / Math.pow(rate,0))
	    }
	    return obj[unit]
	}

	/**
	 * 把指定单位对应的数字转换成单位是Byte/bps的数字
	 * @parma unit 单位 指定的单位
	 * @param value 数值
	 * @param Number
	 */
	widgets.toRightByte = function(unit, v, date) {
	    if(v === null) {
	        return v
	    }

	    var rate = 1000;
	    if (!date) {
	    	date = new Date();
	    }
	    else {
	    	date = new Date(date + " 00:00:00");
	    }
	    if (date.getTime() < 1472659200000)
	    {
	    	rate = 1024;
	    }

	    var obj = {
	        "TB" : (v * Math.pow(rate,4)),
	        "GB" : (v * Math.pow(rate,3)),
	        "MB" : (v * Math.pow(rate,2)),
	        "KB" : (v * Math.pow(rate,1)),
	        "Byte" : (v * Math.pow(rate,0)),
	        "Tbps" : (v * Math.pow(rate,4)),
	        "Gbps" : (v * Math.pow(rate,3)),
	        "Mbps" : (v * Math.pow(rate,2)),
	        "Kbps" : (v * Math.pow(rate,1)),
	        "bps" : (v * Math.pow(rate,0))
	    }
	    return obj[unit]
	}


	return widgets
});/*  |xGv00|31a19ed889e62aa00fe67dacd3b056fe */