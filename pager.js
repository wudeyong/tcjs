define(function(require, exports) {
			var $ = require("cdn/$");
			var defaults = {
                currCountType:"val",
                totalCountType:"val",
				firstBtn : {
					"className" : "tc-15-page-first",
					"disClassName" : "tc-15-page-first disable",
					"el" : null
				},
				nextBtn : {
					"className" : "tc-15-page-next",
					"disClassName" : "tc-15-page-next disable",
					"el" : null
				},
				preBtn : {
					"className" : "tc-15-page-pre",
					"disClassName" : "tc-15-page-pre disable",
					"el" : null
				},
				lastBtn : {
					"className" : "tc-15-page-last",
					"disClassName" : "tc-15-page-last disable",
					"el" : null
				}
			}
			/**
			 * 分页
			 */
			var buildPage = function(pageConfig, settings) {
				var options = $.extend({}, defaults, settings);
				var Pager = function(pageConfig) {
					/**
					 */
					var pageConfig = pageConfig;
					if (pageConfig.totalNum == 0) {
						pageConfig.emptyTurn();
						return;
					}
					pageConfig.maxpage = Math.ceil(pageConfig.totalNum / pageConfig.pageSize);
					var container = $(pageConfig.container);
					// 总数
					var totalEl = container.find("[data-pager=total]");
					// 总数
					var currCountEl = container.find("[data-pager=currcount]");
					// 首页
					var btnFirstEl = container.find("[data-pager=first]");
					// 上一个
					var btnPreEl = container.find("[data-pager=pre]");
					// 下一个
					var btnNextEl = container.find("[data-pager=next]");
					// 最后
					var btnLastEl = container.find("[data-pager=last]");

					totalEl.html(pageConfig.maxpage);
					btnFirstEl.click(function() {
								if (this.className == options.firstBtn.disClassName) {
									return;
								}
								pageConfig.currentpage = 1;
								changeBtn();
								pageConfig.firstBtnCall && pageConfig.firstBtnCall();
							});
					btnNextEl.click(function() {
								if (this.className == options.nextBtn.disClassName) {
									return;
								}
								pageConfig.currentpage++;
								changeBtn();
								pageConfig.nextBtnCall && pageConfig.nextBtnCall();
							});
					btnPreEl.click(function() {
								if (this.className == options.preBtn.disClassName) {
									return;
								}
								pageConfig.currentpage--;
								changeBtn();
								pageConfig.preBtnCall && pageConfig.preBtnCall();
							});
					btnLastEl.click(function() {
								if (this.className == options.lastBtn.disClassName) {
									return;
								}
								pageConfig.currentpage = pageConfig.maxpage;
								changeBtn();
								pageConfig.lastBtnCall && pageConfig.lastBtnCall();
							});
					currCountEl.keydown(function(evt) {
								if (evt.keyCode == 13) {
									var cuPage = this.value - 0;
									if (cuPage > pageConfig.maxpage || cuPage < 1 || cuPage == pageConfig.currentpage) {
										return;
									}
									pageConfig.currentpage = cuPage;
									changeBtn();
								}
							});
					var onTurn = function() {
                        if(options.currCountType=="html"){
                            currCountEl.html(pageConfig.currentpage)
                        }else{
                            currCountEl.val(pageConfig.currentpage)
                        }
						if (pageConfig.maxpage == 1) {
                            btnFirstEl.attr("class",options.firstBtn.disClassName);
                            btnNextEl.attr("class",options.nextBtn.disClassName);
                            btnPreEl.attr("class",options.preBtn.disClassName);
                            btnLastEl.attr("class",options.lastBtn.disClassName);
                            
						} else if (pageConfig.currentpage == 1) {
                            
                            btnFirstEl.attr("class",options.firstBtn.disClassName);
                            btnNextEl.attr("class",options.nextBtn.className);
                            btnPreEl.attr("class",options.preBtn.disClassName);
                            btnLastEl.attr("class",options.lastBtn.className);
                            
						} else if (pageConfig.currentpage > 1 && pageConfig.currentpage < pageConfig.maxpage) {
                            btnFirstEl.attr("class",options.firstBtn.className);
                            btnNextEl.attr("class",options.nextBtn.className);
                            btnPreEl.attr("class",options.preBtn.className);
                            btnLastEl.attr("class",options.lastBtn.className);
                            
						} else if (pageConfig.maxpage > 1 && pageConfig.currentpage == pageConfig.maxpage) {
                            btnFirstEl.attr("class",options.firstBtn.className);
                            btnNextEl.attr("class",options.nextBtn.disClassName);
                            btnPreEl.attr("class",options.preBtn.className);
                            btnLastEl.attr("class",options.lastBtn.disClassName);
						}
					}
					var _this = this;
					var changeBtn = function() {
						onTurn();
						_this.goPage();
					};
					this.goPage = function() {
						pageConfig.onTurn(pageConfig.currentpage, pageConfig.pageSize, pageConfig);
						return this;
					}
					onTurn();
				}
				return new Pager(pageConfig, options);
			}
			exports.buildPage = buildPage;
		});
/*  |xGv00|9a3afbecd90e31e11eed647fe79ccab5 */