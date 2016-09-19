// 开通服务页面
/**
 */
define(function(require, exports, module) {
			var $ = require("cdn/$");
			var dao = require("cdn/data/dao");
			var openTemplate = require("../../templates/open.html.js");
			var noAuthemplate  = require("../../templates/noAuthority.html.js");
			var tmpl = require("cdn/lib/tmpl");
			var dialog = require("cdn/dialog");
			var router = require("cdn/router");
            var pageManager = require('cdn/pageManager');
            var tips = require('cdn/tips');
            
			var _this = {};
			function open() {
				$("[data-cdn-event=selectpay]").click(function(e) {
					e.preventDefault();
					$("[data-cdn-event=selectpay]").removeClass("checked");
					$(this).addClass("checked");
                    var paytype = $("[data-cdn-event=selectpay].checked").data("cdn-paytype");
                    if(paytype=="flux"){
                        $("[data-cdn-payplate=flux]").show();
                        $("[data-cdn-payplate=bandwidth]").hide();
                    }else{
                        $("[data-cdn-payplate=flux]").hide();
                        $("[data-cdn-payplate=bandwidth]").show();
                    }
				});

				$('[_dn_cdn_action="agreement"]').change(function(e) {
					var target = $(this);
					if (target.prop("checked") == true) {
						$("[data-cdn-event='openbtn']").removeClass("disabled");
					}
					else {
						$("[data-cdn-event=openbtn]").addClass("disabled");
					}
				});

				$("[data-cdn-event=openbtn]").click(function(e) {
					var target = $(this);
					/*
					 * 用户点击确认开通，开通成功弹提示框“您已经成功开通腾讯云CDN服务！”，开通失败弹提示框“开通腾讯云CDN服务失败，请稍后重试” 成功后直接跳转到“接入管理首页”（图4）
					 */
					e.preventDefault();
					if (target.hasClass("disabled")) {
						return;
					}

					var paytype = $("[data-cdn-event=selectpay].checked").data("cdn-paytype");
					dao.openReg({
								data : {
									pay_type : paytype
								},
								success : {
									"0" : function() {
										var pop = dialog.create(_this.tmpl.pop1, 480, null, {
											"title" : "成功开通",
											"isMaskClickHide" : false,
                                            "class" :"dialog_layer_v2 success-cdn",
											"button" : {
												"确认" : function() {
													dialog.hide();
													nmc.refreshMenu("cdn", function() {
														router.navigate("/cdn/access");
													});
												}
											},
											"defaultCancelBtn" : false
										})
									},
									"default" : function() {
	                                    var pop = dialog.create(_this.tmpl.pop2, 480, null, {
                                            "title" : "开通CDN",
                                            "isMaskClickHide" : false,
                                            "class" : "dialog_layer_v2 failed-cdn",
                                            "button" : {
                                                "确认" : function() {
                                                    dialog.hide();
                                                }
                                            }
                                        });
									}
								}
							});
				});

				//绑定计算器的计算事件
				$(".js-pay-caculator").on('click',function() {
					var d = dialog.create(tmpl.parse(_this.tmpl.caculator), 600, null, 
							{
								title : '费用计算器',
								preventResubmit : true,
								defaultCancelBtn : false,
								'class' : "dialog_layer_v2 select-project",
								button : {
									'关闭' : function() {
										
										dialog.hide();
										
										return true;
									}
								}
							});
					//计算		
					d.find('.js-asap-caculator').off('click').on('click',function(){
						
						var self = $(this);
						var input = self.prev();
						var val = $.trim(input.val());
						if(val<0 || isNaN(val)){
							tips.error('请在输入框内输入大于0的数字');
							return false;
						}
						if(val>99999999){
							tips.error('请输入小于99999999的数字');
							return false;
						}
						var res = 0;
						/**
						 *	 以当月实际流量为结算标准，按流量阶梯价格计费。
						 *	设当月CDN流量X TB，当月CDN流量结算费用为Y：
						 *	当 X < 2，Y = X*1000*0.34
						 *	当 2 ≦ X < 10， Y = 2*1000*0.34 + (X-2) *1000*0.32
						 *	当 10 ≦ X < 50， Y = 2*1000*0.34 +8 *1000*0.32 + (X-10) *1000*0.3
						 *	当 X ≧ 50， Y = 2*1000*0.34 + 8 *1000*0.32 +40 *1000*0.3 + (X-50) *1000*0.28
                         *  流量是阶梯累进计算的  
						 */
						if(self.parent().hasClass('js-cacl-type-flux')){//计算机单位是GB
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
							if(val>0 && res==0){
								res = 0.01;//流量费用≤0.01元（1分钱），即所用流量≤0.02564GB≈26.256KB 时 收1分钱，无最大消费限制；
							}
							d.find('.js-total-cost').text(res+'元');
								
						/**
						 * 设当月CDN日带宽峰值平均值为X Mbps，当月CDN使用的有效天数为Y，当月CDN带宽结算费用为Z
						 * 当 X < 512，Z = X *1.1 *Y 
						 * 当 512 ≦ X < 5120， Z = [512*1.1 + (X-512)*1.0 ] *Y 
						 * 当 X ≧ 5120， Z = [512*1.1 + (5120-512)*1.0 + (X-5120)*0.9] * Y
                         * 带宽是阶梯到达计算的  
						 */	
						}else if(self.parent().hasClass('js-cacl-type-bandwidth')){
							if(val<=0){
								res = 0;
							}else if(val<512){
								res = val*1.1 * 1;
							}else if(val>=512 && val<5120){
								res = val*1 * 1;
							}else if(val>=5120 && val<51200){
								res = val*0.9 * 1;
							}else if(val>=51200){
								res = val*0.74 * 1;
							}
							res = res.toFixed(2);
							d.find('.js-total-cost').text(res+'元/日');
						}
						
						return false;
					});
					d.find('.js-cacl-item-tab').off('click').on('click',function(){
						var self = $(this);
						self.addClass('b_selected').siblings().removeClass('b_selected');
						if(self.hasClass('js-cacl-item-flux')){
							d.find('.js-cacl-type-flux').show();
							d.find('.js-cacl-type-bandwidth').hide();
						}else if(self.hasClass('js-cacl-item-bandwidth')){
							d.find('.js-cacl-type-bandwidth').show();
							d.find('.js-cacl-type-flux').hide();
						}
						d.find('input').val('');
						d.find('.js-total-cost').text('0元');
						return false;
					});
					
					return false;
				});	

			}
			function reIdentify(data) {
				$("[data-cdn-event=reIdentify]").show().click(function() {
					var _html, _stepBar;
					_html = tmpl.parse(_this.tmpl.open1, data);
					_stepBar = tmpl.parse(_this.tmpl.stepBar, data);
					_html = _stepBar + _html; 
					_this.$e.find(".domain-guide").html(_html)
					$("[data-event=go_auth]").click(function() {
						window.open("/developer?to=auth");
					});
					// $("[data-event=quality_person]").click(function() {
					// 	router.navigate("/developer/infomation?usertype=0");
					// });
					// $("[data-event=quality_company]").click(function() {
					// 	router.navigate("/developer/infomation?usertype=1");
					// });
					// $("[data-event=credit_person]").click(function() {
					// 	window.open('https://www.tenpay.com/v2/')
					// });
					// $("[data-event=credit_company]").click(function() {
					// 	router.navigate("/developer/bankcard");
					// });
				});
			}

			/**
			 * 
			 */
			return {
				container : openTemplate,
				containerNoAuth: noAuthemplate,
				render : function() {
					_this.tmpl = {
						stepBar: $("[data-cdn-tmpl=stepBar]").html(),
						open1 : $("[data-cdn-tmpl=open1]").html(),
						open2 : $("[data-cdn-tmpl=open2]").html(),
						open3 : $("[data-cdn-tmpl=open3]").html(),
						pop1 : $("[data-cdn-tmpl=openpop1]").html(),
                        pop2 : $("[data-cdn-tmpl=openpop2]").html(),
                        caculator : $("[data-cdn-tmpl=dialog_caculator]").html()
					};
					_this.$e = $(".main-wrap");
					dao.getUserStatus({
								data : {},
								success : function(data) {
									data = data || {};
									var _html, _stepBar;

									_stepBar = tmpl.parse(_this.tmpl.stepBar, data);
									$(_stepBar).replaceAll(_this.$e.find("[data-cdnname=stepBar-replace]"))
									if(data.code === 1002) {
										_html = tmpl.parse(_this.tmpl.open1, data);
										$(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
										$("[data-event=go_auth]").click(function() {
											window.open("/developer?to=auth");
										});
										// $("[data-event=quality_person]").click(function() {
										// 	router.navigate("/developer/infomation?usertype=0");
										// });
										// $("[data-event=quality_company]").click(function() {
										// 	router.navigate("/developer/infomation?usertype=1");
										// });
										// $("[data-event=credit_person]").click(function() {
										// 	window.open('https://www.tenpay.com/v2/')
										// });
										// $("[data-event=credit_company]").click(function() {
										// 	router.navigate("/developer/bankcard");
										// });
									}else if(data.code === 1001) {
										_html = tmpl.parse(_this.tmpl.open2, data);
										$(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
									}else if(data.code === 0) {
										_html = tmpl.parse(_this.tmpl.open3, data);
										$(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
										open();
									}else{
										_html = tmpl.parse(_this.tmpl.open2, data);
										$(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
										$('.domain-guide').find('.tc-15-msg').html('您的资质尚未通过审核，请重新提交资料完成认证。');
										$('.domain-guide').find('.tit').html('您的资质审核没有通过，请重新审核！');
										reIdentify(data);
									}
									
								}
							});
				},
				renderNoAuth :  function() {
					$('[_dn_cdn_action="function"]').hide();
					$('[_dn_cdn_action="service"]').show();
				}
			}
		});/*  |xGv00|b682069796114915b7085b4078249fcd */