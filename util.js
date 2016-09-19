define(function(require, exports) {
			var util = {
				// 组件是否已经缓存，用于测速上报
				isCache: false,
				escapeHTML : function(val) {
					var s = val;
					s = s.replace(/&/g, '&amp;');
					s = s.replace(/</g, '&lt;');
					s = s.replace(/>/g, '&gt;');
					s = s.replace(/\x27/g, '&#039;');
					s = s.replace(/\x22/g, '&quot;');
					return s;
				},
				unescapeHTML : function(val) {
					var s = val;
					s = s.replace(/&lt;/g, '<');
					s = s.replace(/&gt;/g, '>');
					s = s.replace(/&(?:apos|#0?39);/g, '\x27');
					s = s.replace(/&quot;/g, '\x22');
					s = s.replace(/&amp;/g, '&');
					return s;
				},
				// encodeHTML VS decodeHTML 主要适用于title属性编码
				encodeHTML : function(val) {
					var s = val;
					s = s.replace(/&/gi, "&amp;");
					s = s.replace(/</gi, "&lt;");
					s = s.replace(/>/gi, "&gt;");
					s = s.replace(/\"/gi, "&quot;");
					s = s.replace(/ /gi, "&nbsp;");
					return s;
				},
				decodeHTML : function(val) {
					var s = val;
					s = s.replace(/&lt;/gi, "<");
					s = s.replace(/&gt;/gi, ">");
					s = s.replace(/&quot;/gi, "\"");
					s = s.replace(/&amp;/gi, "&");
					s = s.replace(/&nbsp;/gi, " ");
					return s;
				},
				format : function(val,sFmt) {
                    var _this = val; 
					function LENFix(i, n) {
						var sRet = i.toString();
						while (sRet.length < n) {
							sRet = "0" + sRet;
						}
						return sRet;
					}
					var mapData = {
						"%Y" : _this.getFullYear(),
						"%m" : LENFix(_this.getMonth() + 1, 2),
						"%d" : LENFix(_this.getDate(), 2),
						"%H" : LENFix(_this.getHours(), 2),
						"%M" : LENFix(_this.getMinutes(), 2),
						"%S" : LENFix(_this.getSeconds(), 2)
					};
					return sFmt.replace(/%[YmdHMS]/g, function(sData) {
								return (mapData[sData]);
							});
				},
			    /**
		         * 测速上报，待开发
		         */
		        reportSpeed : function(config, speedUrl) {
		        	// 有缓存则不再重复上报
		        	if (this.isCache)
		        	{
		        		return;
		        	}
		        	this.isCache = true;
		            speedUrl = [];
		            speedUrl.push( (CDN.protocol=="https:"?"https://huatuospeed.weiyun.com":"http://isdspeed.qq.com") +"/cgi-bin/r.cgi?flag1=" + config.buzId + "&flag2=" + config.siteId + "&flag3=" + config.pageId);
		            var times = [];
		            var start = config.times[0];
		            for (var n in config.times) {
		                if(n){
		                    var item = config.times[n];
		                    if(n!=0 && item){
		                        var flag= n;
		                        times.push(flag + "=" + (item - start));
		                    }
		                }
		                
		            }
		            speedUrl.push(times.join("&"));
		            setTimeout(function() {
		                        var rpt = new Image();
		                        rpt.src = speedUrl.join("&");
		                    }, 500);
		        },
                /**
                 * 测速上报，待开发
                 */
                retCode : function(action,retCode,time) {
                    try{
	                    if(retCode == 0){
	                        //0 以上都未正确
	                        var ctype= 1;
	                    }else if(retCode > 0){
	                        var ctype= 3;
	                    }else{
	                        var ctype= 2;
	                    }
	                    action= new RegExp('(?:^|\\?|&)action=([^&]*)(?:$|&|#)', 'i').exec(action);
	                    var codeUrl = (CDN.protocol=="https:"?"https://huatuocode.weiyun.com":"http://c.isdspeed.qq.com") + "/code.cgi?domain=console.qcloud.com&cgi="
	                            +encodeURIComponent("cdn?action="+action[1])+"&type="+ctype+"&code="+retCode+"&time="+time+"&_="+new Date().getTime();
	                    setTimeout(function() {
	                                var rpt = new Image();
	                                rpt.src = codeUrl;
	                            }, 500);
                    }catch(ex){
                    }
                }, 
				/**
				 * 获取web参数
				 * @param  {String} name
				 * @param  {String} str
				 * @return {String}
				 */
				getParameter :function(name, str) {
					var r = new RegExp("(\\?|#|&)" + name + "=([^&#]*)(&|#|$)");
					var m = (str || location.href).match(r);
					return (!m ? "" : m[2]);
				},
				testUrl: function(value) {
					var $reg_is_url = /\b(([\w-]+:\/\/?|www[.])[^\s()<>]+(?:\([\w\d]+\)|([^[:punct:]\s]|\/)))/;
					return $reg_is_url.test(value);
				},
	            testDomain:function(value){
	                var $reg_is_domain = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.){1,}[a-zA-Z]{2,}$/;
	                return $reg_is_domain.test(value);
	            },
	            testIp:function(value){
	                var $reg_is_ip = /^((([0-9]?[0-9])|(1[0-9]{2})|(2[0-4][0-9])|(25[0-5]))\.){3}(([0-9]?[0-9])|(1[0-9]{2})|(2[0-4][0-9])|(25[0-5]))$/;
	                return $reg_is_ip.test(value);
	            },
				testDomainAndPort: function (value) {
					var ref = value.split(':')
					var host = ref[0]
					var port = ref[1]

					if (!this.testDomain(host)) {
						return false;
					}
					if (port === void 0) { // port 不存在的情况
						return true;
					}
					if (port === '' || !/^\d+$/.test(port)) { // port 为空字符串的情况
						return false;
					}

					return true;
				},
				testIpAndPort: function (value) {
					var ref = value.split(':')
					var host = ref[0]
					var port = ref[1]

					if (!this.testIp(host)) {
						return false;
					}
					if (port === void 0) { // port 不存在的情况
						return true;
					}
					if (port === '' || !/^\d+$/.test(port)) { // port 为空字符串的情况
						return false;
					}

					return true;
				},
				testTelPhone: function (value) {
					// from http://stackoverflow.com/a/24715686/869645
					return /^1[0-9]{10}$/.test(value)
				},
				testEmail: function (value) {
					// from http://stackoverflow.com/questions/46155/validate-email-address-in-javascript/46181#46181
					var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
					return re.test(value);
				},
				//格式化数字,例如输入123.4567则formatNumber(123444555.4567, 2, ',')会输出123,444,555.45
				formatNumber : function(num, precision, separator) {
					var parts;
					if(num==0){
						return num;
					}
					// 判断是否为数字
					if (!isNaN(parseFloat(num)) && isFinite(num)) {
						num = Number(num);
						num = (typeof precision !== 'undefined' ? num.toFixed(precision) : num).toString();
						parts = num.split('.');
						parts[0] = parts[0].toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + (separator || ','));

						return parts.join('.');
					}
					return NaN;
				},
				getBrowserInfo: function() {
					var userAgent = navigator.userAgent; // 取得浏览器的userAgent字符串
					var isOpera = userAgent.indexOf("Opera") > -1;
					if (isOpera) {
						return "Opera"
					}; // 判断是否Opera浏览器
					if (userAgent.indexOf("Firefox") > -1) {
						return "FF";
					} // 判断是否Firefox浏览器
					if (userAgent.indexOf("Chrome") > -1) {
						return "Chrome";
					}
					if (userAgent.indexOf("Safari") > -1) {
						return "Safari";
					} // 判断是否Safari浏览器
					if (userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && !isOpera) {
						return "IE";
					}; // 判断是否IE浏览器
				},
				// 对流量带宽进行单位转换
				// type:bandwidth|flux, num:数值,unit:K|M|G|T|P,timestamp:时间戳
				unitConvert: function(type, num, unit, timestamp) {
					var unitArr = ["", "K", "M", "G", "T", "P"];
					var count = 0;
					// 以2016-09-01 00:00:00为分界线
					var separateTime = 1472659200000;
					var rate = 1000;
					var res;
					if (!timestamp && timestamp != 0) {
						timestamp = new Date().getTime();
					}
					else {
						timestamp = +timestamp;
					}
					if (timestamp < separateTime) {
						rate = 1024;
					}
					unit = unit || "";
					if (unit.indexOf("K") > -1) {
						res = (num / rate).toFixed(2) * 1;
					}
					else if (unit.indexOf("M") > -1) {
						rate = Math.pow(rate,2);
						res = (num / rate).toFixed(2) * 1;
					}
					else if (unit.indexOf("G") > -1) {
						rate = Math.pow(rate,3);
						res = (num / rate).toFixed(2) * 1;
					}
					else if (unit.indexOf("T") > -1) {
						rate = Math.pow(rate,4);
						res = (num / rate).toFixed(2) * 1;
					}
					else if (unit.indexOf("P") > -1) {
						rate = Math.pow(rate,5);
						res = (num / rate).toFixed(2) * 1;
					}
					else {
						unit = "";
						res = num;
						while(res >= rate) {
							res = res / rate;
							count++;
							unit = unitArr[count];
						}
						res = res.toFixed(2) * 1;
					}
					
					if (type == "bandwidth" && unit.indexOf("bps") == -1)
					{
						unit = unit + "bps";
					}
					else if (unit.indexOf("B") == -1) {
						unit = unit + "B";
					}

					return {
						num : res,
						unit : unit
					}
				},

				// 获取使用1024单位转换的天数及总天数
				unitConvertDays: function(startDate, endDate) {
				    var oneDay = 1000 * 60 * 60 *24;
				    // 兼容一下日期格式
				    startDate = startDate.replace(/-/g, "/");
				    endDate = endDate.replace(/-/g, "/");
				    var startTimeStamp = new Date(startDate + " 00:00:00").getTime();
				    var endTimeStamp = new Date(endDate + " 00:00:00").getTime() + oneDay;
				    var totalDays = (endTimeStamp - startTimeStamp) / oneDay;
				    var use1024;
				    if (startTimeStamp >= 1472659200000) {
				        use1024 = 0;
				    }
				    else if (endTimeStamp < 1472659200000) {
				        use1024 = totalDays;
				    }
				    else {
				        use1024 = (1472659200000 - startTimeStamp) / oneDay;
				    }
				    return {
				        use1024: use1024,
				        total:totalDays
				    }
				},
				
				// 判断是否内网ip，是内网返回false
				/*
					"10.0.0.0" => "10.255.255.255", 167772160 => 184549375
		            "127.0.0.0" => "127.255.255.255", 2130706432 => 2147483647
		            "172.16.0.0" => "172.31.255.255", 2886729728 => 2887778303
		            "192.168.0.0" => "192.168.255.255", 3232235520 => 3232301055
				**/
				checkIntranet: function(ip) {
					var ipSectionReg = /(\d+)/g;
					var ipSection = ip.match(ipSectionReg);
					var ipValue = +ipSection[0] * 16777216 + +ipSection[1] * 65536 + +ipSection[2] * 256 + +ipSection[3];
					if ((ipValue >= 167772160 && ipValue <= 184549375) || (ipValue >= 2130706432 && ipValue <= 2147483647) || (ipValue >= 2886729728 && ipValue <= 2887778303) || (ipValue >= 3232235520 && ipValue <= 3232301055))
					{
						return false;
					}
					else {
						return true;
					}
				}
			}
			return util;
		});/*  |xGv00|06232637904593052d2d6584847a6a6f */