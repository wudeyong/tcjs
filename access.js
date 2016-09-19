/*
 * 接入管理页面
 */
define(function(require, exports, module) {
	var $ = require("cdn/$");
	var _ = require("cdn/lib/underscore");
	var tmpl = require("cdn/lib/tmpl");
	var dao = require('cdn/data/dao');
	var accessTemplate = require("../../templates/access.html.js");
	var highchart = require("cdn/highcharts");
	var dateUtil = require('cdn/lib/date');
	var manager = require('cdn/manager');
	var util = require('cdn/util');
	var cdnutil = require('cdn/lib/util');
	var router = require("cdn/router");
	var evt = require('cdn/event');
	var pager = require('cdn/lib/pager');
	var dropdown = require('cdn/dropdown');
	var projectsSelector = require('cdn/projectsSelector');
	var regionSelector = require('cdn/regionSelector');
	var datepicker = require('cdn/datepicker');
	var range = require('cdn/range');
	var dialog = require('cdn/dialog');
	var search = require('cdn/search');
	var panel = require('cdn/panel');
	var evt = require('cdn/event');
	var contextMenu = require('cdn/contextmenu');
	var tips = require('cdn/tips');
	var ajaxPostForm = require('cdn/lib/ajaxPostForm');
	require("cdn/lib/placeholder");
	var eventproxy = require('cdn/lib/eventproxy')

	var _this = {
		page: 20,
		totalLimit: 3000,
		appid: $.cookie("cdn_appid")
	};



	var _ftpInfo;
	var refreshStatusInterval; // 接入管理页的状态会定时刷新
	var g_currentPage = 1; // 临时记录当前的页数，刷新页面时重置
	var _total_all = 0;	//未进行筛选及搜索时的总数
	var _total_search = 0;	//搜索时的总数


	var OVERSEA_STAT = {
		NOT_OPEN: 0, // 未开启
		VERIFYING: 1, // 正在审核
		VERIFY_SUCCESS: 2, // 审核成功
		VERIFY_FAIL: 3, // 审核失败
	}

	function startCdn(idList) {
		dialog.create(_this.tmpl.dialog_4, '480', '', {
			title: '开启CDN',
			preventResubmit: true,
			"class": "dialog_layer_v2 shutdown-cdn",
			button: {
				'确定开启': function() {
					dialog.hide();
					setHostList({
						host_id: idList.join(","),
						enable_cdn: "yes"
					}, function(rs) {
						refreshTr(idList, rs);
						tips.success("开启CDN服务成功！");
					});
				}
			}
		});
	}

	function startCdnSp(idList) {
		dialog.create(_this.tmpl.dialog_4S, '550', '', {
			title: '开启CDN',
			preventResubmit: true,
			"class": "dialog_layer_v2 shutdown-cdn",
			button: {
				'确定开启': function() {
					dialog.hide();
					setHostList({
						host_id: idList.join(","),
						enable_cdn: "yes"
					}, function(rs) {
						refreshTr(idList, rs);
						tips.success("开启CDN服务成功！");
					});
				}
			}
		});
	}

	function closeCdn(idList) {
		dialog.create(_this.tmpl.dialog_5, '480', '', {
			title: '关闭CDN',
			preventResubmit: true,
			"class": "dialog_layer_v2 shutdown-cdn",
			button: {
				'确定关闭': function() {
					dialog.hide();
					setHostList({
						host_id: idList.join(","),
						enable_cdn: "no"
					}, function(rs) {
						refreshTr(idList, rs);
						tips.success("关闭CDN服务成功！");
					});

				}
			}
		});
	}

	function closeCdnSp(idList) {
		dialog.create(_this.tmpl.dialog_5S, '550', '', {
			title: '关闭CDN',
			preventResubmit: true,
			"class": "dialog_layer_v2 shutdown-cdn",
			button: {
				'确定关闭': function() {
					dialog.hide();
					setHostList({
						host_id: idList.join(","),
						enable_cdn: "no"
					}, function(rs) {
						refreshTr(idList, rs);
						tips.success("关闭CDN服务成功！");
					});

				}
			}
		});
	}

	function modifyProject(idList, cb) {
		dialog.create(tmpl.parse(_this.tmpl.dialog_6, {
			list: _this.data.projects
		}), '480', '', {
			title: '修改所属项目',
			preventResubmit: true,
			"class": "dialog_layer_v2 select-project",
			button: {
				'确定': function() {
					var sVal = arguments[1].find("select").val();

					dialog.hide();
					setHostList({
						host_id: idList.join(","),
						project_id: sVal
					}, function(rs) {
						cb(idList, rs, sVal);
						tips.success("修改域名所属项目成功！");
					});
				}
			}
		});
	}

	function ftpModifyProject(idList, cb) {
		dialog.create(tmpl.parse(_this.tmpl.dialog_6_1), '480', '', {
			title: '修改所属项目',
			preventResubmit: true,
			"class": "dialog_layer_v2 select-project",
			button: {
				'确定修改': function() {
					modifyProject(idList, cb);
				}
			}
		});
	}

	function delCdn(idList) {
		dialog.create(tmpl.parse(_this.tmpl.dialog_7, {}), '480', '', {
			title: '删除源',
			preventResubmit: true,
			"class": "dialog_layer_v2 failed-cdn",
			button: {
				'确定': function() {
					dialog.hide();
					dao.delHost({
						data: {
							host_id: idList.join(",")
						},
						success: {
							"0": function(rs) {
								$(idList).each(function(i, hostid) {
									_.find(_this.data.hosts, function(n, idx) {
										if (n.host_id == hostid) {
											_this.data.hosts = _.without(_this.data.hosts, n);
											return true;
										}
										return false
									});
									$("[data-cdn-hostid=" + hostid + "]").remove();
									_total_all--;
									_total_search--;
									_this.data.total--;
									$("[data-cnd-name=total]").text(_this.data.total);
								})
								if ($("[data-cdn-hostid]").length == 0) {
									clearInterval(refreshStatusInterval);
									main();
								}
							},
							"default": function(rs) {
								if (rs.msg) {
									tips.error(rs.msg);
								} else {
									tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
								}
							}
						}
					});
					dialog.hide();
				}
			}
		});
	}

	function setItem(item) {
		_.find(_this.data.hosts, function(n, i) {
			if (n.host_id == item.host_id) {
				_this.data.hosts[i] = $.extend(true, n, item);
				return true
			}
			return false
		});
	}

	function setHostList(data, succ0) {
		dao.setHostList({
			data: data,
			success: {
				"0": succ0,
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		});
	}

	function refreshTr(idList, rs) {
		// td 处理数组
		$(idList).each(function(i, hostId) {
			var item = _.find(rs.data, function(hostObj) {
				return hostObj.host_id == hostId;
			})
			setItem(item)
		});
		resetData(_this.data);
		refresh(idList);
	}

	function refresh(idList) {
		$(idList).each(function(i, host_id) {
			var item = _.find(_this.data.hosts, function(n) {
				return n.host_id == host_id
			});
			var _html = tmpl.parse(_this.tmpl.mainList, {
				list: [item],
				show_projects: _this.data.show_projects
			});
			var cDom = $("[data-cdn-hostid=" + host_id + "]");
			var checked = cDom.find(":checkbox").prop("checked");
			$(_html).replaceAll(cDom);
			$("[data-cdn-hostid=" + host_id + "]").find(":checkbox").prop("checked", checked);
		})
		trEvent();
	}

	// 将数据中的状态码翻译成中文
	function resetData(data) {
		$(data.hosts).each(function(i, m) {
			var p = _.find(data.projects, function(n) {
				return m.project_id == n.id
			});
			m.proInfo = p ? p.info : "";
			if (m.status == "0") {
				m.statusText = "待认证";
				m.statusClass = "n-error-icon";
			} else if (m.status == "1") {
				m.statusText = "审核中";
				m.statusClass = "records-icon";
			} else if (m.status == "4") {
				m.statusText = "部署中";
				m.statusClass = "n-restart-icon";
			} else if (m.status == "5") {
				m.statusText = "已启动";
				m.statusClass = "n-success-icon";
			} else if (m.status == "6") {
				m.statusText = "已关闭";
				m.statusClass = "n-shutdown-icon";
			} else if (m.status == "8") {
				m.statusText = "未启动";
				m.statusClass = "n-shutdown-icon";
			} else if (m.status == "2") {
				m.statusText = "审核未通过";
				m.statusClass = "n-error-icon";
			}


			// 0 无
			// 1 qq 证书 http 回源
			// 2 自提供证书 http 回源
			// 3 qq 证书 https 回源
			// 4 自提供证书 https 回源
			if (m.ssl_type == 0) {
				m.httpsClass = ''
			} else if (m.ssl_type == 2 || m.ssl_type == 4 || m.ssl_type == 5 || m.ssl_type == 6) {
				m.httpsClass = 'icon-lock-pri'
				m.httpsText = '私用https'
			} else if (m.ssl_type == 1 || m.ssl_type == 3) {
				m.httpsClass = 'icon-lock-pub'
				m.httpsText = '公用https'
			}

			if (m.host_type == "cname") {
				m.hostTypeText = "自有源";
			} else if (m.host_type == "ftp") {
				m.hostTypeText = "ftp托管源";
			} else if (m.host_type == 'cos') {
				m.hostTypeText = "COS源";
			}
		});
	}

	function buildPage(p, data) {
		var s =   '<div class="tc-15-page" data-cdn-name="paginationArea">' +
				'<div class="tc-15-page-state"><span class="tc-15-page-text">已选<strong data-page=sel>0</strong>项，共<strong data-cnd-name="total"></strong>项</span>' +
				'</div>' +
				'<div class="tc-15-page-operate"><span class="tc-15-page-text">每页显示20行</span>' +

				'<a href="javascript:void(0);" data-pager="first" title="第一页" class="tc-15-page-first disable"></a>' +
				'<a href="javascript:void(0);" data-pager="pre" title="上一页" class="tc-15-page-pre disable"></a>' +
				'<span class="tc-15-page-num"><font data-pager=currcount></font>/<font data-pager="total"></font></span>' +
				'<a href="javascript:void(0);" data-pager="next" title="下一页" class="tc-15-page-next"></a>' +
				'<a href="javascript:void(0);" data-pager="last" title="最后一页" class="tc-15-page-last"></a>' +
				'</div>' +
				'</div>';
		$(s).replaceAll("[data-cdn-name=paginationArea]");

		if(_this.data.total >= _this.totalLimit) {
			$("[data-cnd-name=total]").text(_this.data.total);
		}else {
			$("[data-cnd-name=total]").text(data.length);
		}

		function goPage(page) {

			g_currentPage = page;
			$("[data-cnd-name=list]").html(tmpl.parse(_this.tmpl.mainList, {
				list: data.slice((page - 1) * _this.page, page * _this.page),
				show_projects: _this.data.show_projects
			}));
			trEvent();
		}

		if ( (p - 1) * _this.page > data.length) {
			p = 1;
		}
		goPage(p);
		pager.buildPage({
			"pageSize": _this.page,
			"currentpage": p,
			"totalNum": data.length,
			"onTurn": function(currentpage, pagesize) {
				$("[data-cdn-event=selectAll]").attr("checked", false);
				$("[data-page=sel]").text(0);
				goPage(currentpage);
			},
			"emptyTurn": function(currentpage) {
				$("[data-cnd-name=list]").html(tmpl.parse(_this.tmpl.main_nolist, {
					show_projects: _this.data.show_projects
				}));
				$("[data-page=btn]").hide();
			},
			"container": $("[data-cdn-name=paginationArea]")[0]
		}, {
			"currCountType": "html"
		});

	}

	function trEvent() {

		$('[_dn_action="manage_domain"]').off('click').click(function () {
			var hostid = $(this).closest('[data-cdn-event="list_view"]').attr('data-cdn-hostid')
			router.navigate('/cdn/access/manage/' + hostid);
		})

		$('[_dn_action="audit_domain"]').off('click').click(function () {

			var hostid = $(this).closest('[data-cdn-event="list_view"]').attr('data-cdn-hostid')
			var host = $(this).closest('[data-cdn-event="list_view"]').attr('data-cdn-host')

			dao.audit_host({
				data: {
					host: host
				},
				success: {
					"0": function () {
						tips.success('审核通过！')
						_updateListView([hostid])
					},
					"default": function(rs) {
						if (rs.msg) {
							tips.error(rs.msg);
						} else {
							tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
						}
					}
				}
			})


		})

		$("[data-cdn-event=sel]").off('click').click(selEvent); // 记录有多少个 checkbox 被选择了
	}

	function bindEvent() {
		var operAreaEl = $("[data-cdn-name=operArea]");
		this.moreDropdown = new dropdown(operAreaEl.find('.ui-dropdown'), {
			buttonObj: operAreaEl.find('.btn-link')
		});
		$("[data-cdn-event=selectAll]").click(function(event) {
			var aBox = $(event.target);
			var cbox = $("[data-cdn-event=sel]");
			if (aBox.prop("checked") == true) {
				cbox.prop("checked", true);
			} else {
				cbox.prop("checked", false);
			}
			$("[data-page=sel]").text($("[data-cdn-event=sel]").filter(":checked").length);
		});
		//left 解决ie下没有覆盖的问题
		$("[_dn_data=search-domain-input]").placeholder({
			"cssList": {
				"left": 0
			}
		});
		$("[_dn_action=search-domain]").click(function() {

			// 去掉筛选器的筛选
			$('[_dn_data="check_list_filter_popup"]:checked').prop('checked', false)

			var serchVal = $("[_dn_data=search-domain-input]").val();
			if ($.trim(serchVal) == "") {
				clearInterval(refreshStatusInterval);
				main()
			} else {
				_this.serchVal = serchVal;

				var searchArr = serchVal.split('&');
				var hosts;
				for (var i = 0; i < searchArr.length; i++) {
					var tmpVal = searchArr[i];
					if (i == 0) {
						hosts = _this.data.hosts;
					}
					if ($.trim(tmpVal) == "") {
						continue;
					}
					hosts = _.filter(hosts, function(item) {
						if (item.host.indexOf(tmpVal) > -1 || item.proInfo.indexOf(tmpVal) > -1 || item.statusText.indexOf(tmpVal) > -1 || item.hostTypeText.indexOf(tmpVal) > -1) {
							return true;
						} else {
							return false
						}
					});

				}

				if(_total_all < _this.totalLimit) {
					// 一次已经拉完则在本地缓存可找到
					_this.data.total = hosts.length;
					_total_search = hosts.length;
					buildPage(1, hosts);
				}else {
					// 一次没拉完，则本地缓存不全，去拉接口
					dao.getHostList({
						data: {
							keyword: serchVal,
							start_page: 1,
							page_limit: _this.totalLimit,
							mode: 'access',
							field: 'host'
						},
						success: {
							"0": function(rs) {
								_this.data = rs.data;
								_total_search = rs.data.total;
								resetData(rs.data)
								buildPage(1, rs.data.hosts);
							},
							"default": function(rs) {
								if (rs.msg) {
									tips.error(rs.msg);
								} else {
									tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
								}
							}
						}
					})
				}
			}
		});

		// 更多操作的dropdown功能实现
		$('.tc-15-dropdown').click(function () {
			var $that = $(this);
			var activeClass = 'tc-15-menu-active'
			var isOpen = $that.hasClass(activeClass)

			if (isOpen) {
				$that.removeClass(activeClass)
			} else {
				$('body').one('click', function () {
					$that.removeClass(activeClass)
				})

				$that.addClass(activeClass)
			}
			return false;
		})

		// 更多操作里面的【关闭】【修改项目】等操作
		$("[data-cdn-name=operArea]").find("[data-cdn-event]").click(function() {
			var eventType = $(this).data("cdn-event");
			var selList = $("[data-cdn-event=sel]").filter(":checked");
			if (selList.length == 0) {
				// tips.error('请选择需要操作的源');
				return
			}
			// 从 get_host_list 返回的数据中, 找出用户选择的那些
			var data = [];
			var hostElements = {};
			selList.each(function (idx, item) {
				var hostid = $(this).parents("[data-cdn-hostid]").data("cdn-hostid");
				var host = _.find(_this.data.hosts, function (n) {
					return n.host_id == hostid;
				});

				hostElements[host.host_id] = $(this); // 将对应的元素存起来
				//host.$el = $(this); // 将对应的元素存在 host 变量中
				data.push(host);
			})

			// 检查选择的域名中是否有被锁定的域名
			var readOnlyHosts = _.filter(data, function (item) {
				return item.readonly;
			});

			// 如存在被锁定域名, 则不允许任何修改
			if (readOnlyHosts.length !== 0) {
				tips.error('该域名已进入系统保护，若需修改，请在配置管理页面查看详情。')
				// 变色警告
				_.each(readOnlyHosts, function (host) {
					var $tr = hostElements[host.host_id].closest('tr')
					var originColor = $tr.css('background-color')
					$tr.css({'background-color': 'rgb(255, 248, 235)'})
					setTimeout(function () {
						$tr.css({'background-color': originColor})
					}, 2000);
				});
				// END 变色警告
				return;
			}
				/**
				 * if (m.status == "0") { m.statusText = "待认证" } else if (m.status == "1") { m.statusText = "审核中" } else if (m.status == "4") { m.statusText = "部署中" } else if (m.status ==
				 * "5") { m.statusText = "已启动" } else if (m.status == "6") { m.statusText = "已关闭" } else if (m.status == "2") { m.statusText = "审核未通过" }
				 */
			var idList = [];
			var hasOldCname = false;
			if (eventType == "startCdn") {
				var l = _.find(data, function(item) {
					return item.status != 6; // 只有已关闭状态才可以操作
				});
				$(data).each(function(i, item) {
					idList.push(item.host_id);
					if (!hasOldCname && item.cname.indexOf("cloud.cdntip.com") > -1) {
						hasOldCname = true;
					}
				});
				if (l) {
					tips.error('启动操作只能作用于“已关闭”状态的域名，请重新选择。');
				} else {
					if (hasOldCname) {
						startCdnSp(idList);
					}
					else {
						startCdn(idList);
					}
				}
			} else if (eventType == "closeCdn") {
				var l = _.find(data, function(item) {
					return item.status != 5; // 只有已启动状态才可以操作
				});
				$(data).each(function(i, item) {
					idList.push(item.host_id);
					if (!hasOldCname && item.cname.indexOf("cloud.cdntip.com") > -1) {
						hasOldCname = true;
					}
				});
				if (l) {
					tips.error('关闭操作只能作用于“已启动”状态的域名，请重新选择。');
				} else {
					if (hasOldCname) {
						closeCdnSp(idList);
					}
					else {
						closeCdn(idList);
					}
				}

			} else if (eventType == "modifyCdn") {
				var l = _.find(data, function(item) {
					return  item.status != 5 && item.status != 4;
				});
				var hasFtp = false;
				$(data).each(function(i, item) {
					if (!hasFtp && item.host_type == "ftp") {
						hasFtp = true;
					}
					idList.push(item.host_id);
				});
				if (l) {
					tips.error('只可修改【已启动】或【部署中】状态的域名。')
				} else if (hasFtp) {
					ftpModifyProject(idList, function() {
						refreshTr.apply(null, arguments);
					});
				} else {
					modifyProject(idList, function() {
						refreshTr.apply(null, arguments);
					});
				}
			} else if (eventType == "delCdn") {
				var l = _.find(data, function(item) {
					return item.status != 1 && item.status != 2 && item.status != 6; // 只有待认证 和审核未通过的才可以进行操作
				});
				$(data).each(function(i, item) {
					idList.push(item.host_id);
				});
				if (l) {
					tips.error(' 删除操作不能作用于“已启动”和“部署中”状态的域名，请重新选择。');
				} else {
					delCdn(idList);
				}
			}
		});


		var filterValues = {};
		$('[_dn_action="list-filter"]').click(function (e) {
			var $this = $that = $(this);

			var siblingsPopup = $this.siblings('[_dn_data="list_filter_popup"]')

			if (siblingsPopup.length > 0) {
				siblingsPopup.toggle()
				return false;
			}

			var filterType = $this.attr('_dn_data')

			var valueProp, textProp
			if (filterType == 'status') {
				valueProp = 'status'
				textProp = 'statusText'
			} else if (filterType == 'host_type') {
				valueProp = 'host_type'
				textProp = 'hostTypeText'
			} else if (filterType == 'project') {
				valueProp = 'project_id'
				textProp = 'proInfo'
			}

			var filterOptions = _.map(_this.data.hosts, function (hostObj) {
				return {value: hostObj[valueProp], text: hostObj[textProp]}
			})

			filterOptions = _.filter(filterOptions, function(hostObj) {
				return hostObj.text !== ''
			})
			
			filterOptions = _.uniq(filterOptions, false, function (obj) {
				return JSON.stringify(obj)
			});

			filterOptions.unshift({value: -99, text: '全部'})

			var popupStr = tmpl.parse(_this.tmpl.list_filter_popup, {
				filterOptions: filterOptions,
			})

			var $popup = $(popupStr)

			$this.after($popup)

			$popup.find('[_dn_action="cancel_list_filter_popup"]').click(function () {
				$popup.hide()
			})

			$popup.find('[_dn_data="check_list_filter_popup"]').change(function (e) {
				var $this = $(this);

				var values = []
				if ($this.val() == -99) {
					$popup.find('[_dn_data="check_list_filter_popup"]').not($this).prop('checked', $this.prop('checked'));
				} else {
					values = $popup.find('[_dn_data="check_list_filter_popup"]:checked').map(function (index, el) {
						if ($(el).val() != -99) {
							return $(el).val()
						}
					}).toArray()
					values = _.compact(values)

					if (values.length == filterOptions.length - 1) {
						$popup.find('[_dn_data="check_list_filter_popup"]').filter('[value=-99]').prop('checked', true)
					} else {
						$popup.find('[_dn_data="check_list_filter_popup"]').filter('[value=-99]').prop('checked', false)
					}
				}

				// 把筛选条件记录到外部变量
				if (values.length == 0) {
					delete filterValues[valueProp];
				} else {
					filterValues[valueProp] = values
				}
			})

			$popup.find('[_dn_action="submit_list_filter_popup"]').click(function (e) {

				// 去掉搜索框的条件
				if(_total_all < _this.totalLimit) {
					$('[_dn_data="search-domain-input"]').val('')
				}

				// 根据外部变量，筛选多个选择器的结果
				var filteredHosts = _this.data.hosts;
				var len = filteredHosts.length;

				_.each(filterValues, function (_values, _valueProp) {
					// 不同筛选器选交集
					filteredHosts = _.filter(filteredHosts, function (hostObj) {
						// 统一筛选器取并集
						for (var i = 0; i < _values.length; i++) {
							if (_values[i] == hostObj[_valueProp]) {
								return true;
							}
						}
					})
				})

				if(len === filteredHosts.length) {
					_this.data.total = _total_search;
				}else {
					_this.data.total = filteredHosts.length;
				}

				buildPage(1, filteredHosts)

				$popup.toggle()
			})


			$('body').on('click', function (e) {
				if ($(e.target).closest('[_dn_data="list_filter_popup"]').length == 0) {
					$popup.hide()
				}
			})
			return false;
		})

		$('[_dn_data=search-domain-input]').keydown(function(e) {
			if(e.which === 13) {
				$("[_dn_action=search-domain]").click()
			}
		})
	}

	// 记录有多少个 checkbox 被勾选
	function selEvent() {
		var selAll = $("[data-cdn-event=selectAll]");
		var len = $("[data-cdn-event=sel]").filter(":checked").length;
		$("[data-page=sel]").text(len);
		if (len == $("[data-cnd-name=total]").text()) {
			selAll.prop("checked", true);
		} else {
			selAll.prop("checked", false);
		}

		var cdnEvent = $("[data-cdn-name=operArea]").find("[data-cdn-event]");
		if (len == 0) {
			$('[data-cdn-event=startCdn]').addClass('disabled')
			$('.tc-15-dropdown-menu li').addClass('disabled')
		}else{
			$('[data-cdn-event=startCdn]').removeClass('disabled')
			$('.tc-15-dropdown-menu li').removeClass('disabled')
		}
	}

	function showList(rs) {
		/**
		 * 已经有域名了
		 */
		$(tmpl.parse(_this.tmpl.main_2, {
			data: rs.data
		})).replaceAll($(".cdncontainer"));
		resetData(rs.data);
		// 右键菜单组件
		function geItem(el) {
			var hostid = $(el).data("cdn-hostid");
			return _.find(_this.data.hosts, function(n) {
				return n.host_id == hostid
			});;

		}
		var memuCallback = [{
			"启动cdn": function(el) {
				var item = geItem(el);
				startCdn([item.host_id]);
			}
		}, {
			"关闭cdn": function(el) {
				var item = geItem(el);
				closeCdn([item.host_id]);
			}
		}, {
			"修改所属项目": function(el) {
				var item = geItem(el);
				modifyProject([item.host_id], function() {
					refreshTr.apply(null, arguments);
				});
			}
		}, {
			"删除": function(el) {
				var item = geItem(el);
				delCdn([item.host_id]);
			}
		}];
		/**
		 * CDN状态 海外CDN状态 右键操作
		 * 待认证（域名归属认证） 无 修改所属项目（cname），删除 0
		 * 审核未通过 无 修改所属项目（cname），删除 2
		 * 审核中 无 修改所属项目（cname） 1
		 * 部署中 无 修改所属项目（cname） 4
		 * 已启动 关 关闭CDN，关闭海外CDN， 修改所属项目（cname） 5
		 * 已关闭 开 关闭CDN，启用海外CDN，修改所属项目（cname） 6
		 */
		new contextMenu({
			object: $("[data-cnd-name=listArea2]"),
			selector: 'tbody tr',
			getData: function(el) {
				var modifyProject = memuCallback.modifyProject;
				var del = memuCallback.del;
				var menuList = {};
				var item = geItem(el);
				if (item.status == "5") {
					if (_this.data.show_projects && item.host_type != 'cos') {
						menuList = $.extend(false, {}, memuCallback[1], memuCallback[2]);
					} else {
						menuList = $.extend(false, {}, memuCallback[1]);
					}
				} else if (item.status == "6") {
					menuList = $.extend(false, {}, memuCallback[0], memuCallback[3]);
				} else if (item.status == 1 || item.status == 2 || item.status == 6) {
					menuList = $.extend(false, {}, memuCallback[3]);
				}
				return [menuList];
			}
		});

		buildPage(g_currentPage, _this.data.hosts)
		bindEvent();

	}

	function main() {
		dao.getHostList({
			data: {
				start_page: 1,
				page_limit: _this.totalLimit,
				mode: 'access',
				field: 'host'
			},
			success: {
				"0": function(rs) {
					_this.data = rs.data;
					_total_all = _this.data.total;
					_total_search = _this.data.total;

					if (rs.data.hosts && rs.data.hosts.length > 0) {
						if (rs.data.app_id)
						{
							_this.appid = rs.data.app_id;
						}
						showList(rs);

						// 定时刷新各个域名的接入状态
						refreshStatusInterval = setInterval(updateListView, 60 * 1000);
					} else {
						/**
						 * 已经开通成功了
						 */
						$(tmpl.parse(_this.tmpl.main_2, {
							data: _this.data
						})).replaceAll($(".cdncontainer"));
						$("[data-cnd-name=list]").html('<tr>' +
								'<td colspan="7" style="text-align:center">' +
								'<div>' +
								'<b class="n-error-icon"></b> ' +
								'<span>当前尚无域名接入CDN，请添加域名！</span>' +
								'</div>' +
								'</td>' +
								'</tr>')
					}

					// 异步执行开通海外cdn的那块逻辑
					overseaLogic()

					$("[data-cnd-event=addhost]").off('click').on('click', function() {
						router.navigate("/cdn/access/guid");
					});
				},
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		})
	}

	// 海外cdn逻辑 start
	function getOverseaStat(options, callback) {
		dao.get_oversea_stat({
			success: {
				"0": function(rs) {
					callback(null, rs.data)
				},
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		})

		// "status": 0/未开通 1/审核中  2/审核通过 3/审核失败
		// setTimeout(function () {
		// 	callback(null, {
		// 		status: OVERSEA_STAT.NOT_OPEN,
		// 	})
		// })
	}

	function getUserWhiteList(options, callback) {
		dao.get_white_list({
			success: {
				"0": function(rs) {
					callback(null, rs.data)
				},
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		})
		// setTimeout(function () {
		// 	callback(null, {
		// 		"vip-platform": {
		// 			"item_id":16,
		// 			"item":"vip-platform",
		// 			"value":"on",
		// 			"show_name":"大客户平台",
		// 			"expire_time":"2099-01-01 01:00:00",
		// 			"expired":"no",
		// 			"mutable":1
		// 		}
		// 	})
		// })
	}

	function getUserBasicInfo(options, callback) {
		dao.get_userbasic_info({
			success: {
				"0": function(rs) {
					callback(null, rs.data)
				},
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		})
		// setTimeout(function () {
		// 	callback(null, {
		// 		name: 'alsotang',
		// 		tel: '18665962304',
		// 		mail: 'alsotang@tencent.com',
		// 	})
		// })
	}

	function overseaLogic() {
		var $overseaBtn = $('[data-cdn-event="overseaApply"]')

		var ep = new eventproxy();
		ep.fail(function (err) {
			console.error('overseaLogic error', err)
		})

		getOverseaStat({}, ep.done('overseaStat'))
		getUserWhiteList({}, ep.done('userWhiteList'))
		getUserBasicInfo({}, ep.done('userBasicInfo'))

		ep.all('overseaStat', 'userWhiteList', 'userBasicInfo', function (overseaStat, userWhiteList, userBasicInfo) {
			var isVip = userWhiteList["vip-platform"].value == 'on';
			if (isVip) {
				$overseaBtn.show();
				showBtnText(overseaStat)
				$overseaBtn.click(function (e) {

					if (overseaStat.status == OVERSEA_STAT.NOT_OPEN) {
						var $overseaName,
							$overseaTel,
							$overseaMail,
							$overseaServiceType,
							$overseaHost,
							$overseaArea,
							$overseaBandwidth,
							$overseaOrigin,
							$overseaCache,
							$overseaHy,
							$overseaFilter,
							$overseaTest;

						var applyBtnOk; // 控制【申请】按钮是否变灰

						function addErrorFlag($el, msg) {
							$el.closest('.form-unit').addClass('is-error')
							$el.closest('.form-unit').find('.form-input-help').text(msg)

						}

						function removeErrorFlag($el, msg) {
							msg = msg || ''
							$el.closest('.form-unit').removeClass('is-error')
							$el.closest('.form-unit').find('.form-input-help').text(msg)
						}

						dialog.create(_this.tmpl.oversea_add_dialog, '630', '', {
							title: '申请开通海外CDN',
							"class": "dialog_layer_v2 oversea_add_dialog",
							onload: function ($dialog) {
								$overseaName = $dialog.find('[data-cdn-event="oversea-name"]');
								$overseaTel = $dialog.find('[data-cdn-event="oversea-tel"]');
								$overseaMail = $dialog.find('[data-cdn-event="oversea-mail"]');
								$overseaServiceType = $dialog.find('[data-cdn-event="oversea-service_type"]');
								$overseaHost = $dialog.find('[data-cdn-event="oversea-host"]');
								$overseaArea = $dialog.find('[data-cdn-event="oversea-area"]');
								$overseaBandwidth = $dialog.find('[data-cdn-event="oversea-estimate_bandwidth"]');

								$overseaOrigin = $dialog.find('[data-cdn-event="oversea-origin"]');
								$overseaCache = $dialog.find('[data-cdn-event="oversea-cache"]');
								$overseaHy = $dialog.find('[data-cdn-event="oversea-hy"]');
								$overseaFilter = $dialog.find('[name="oversea-filter"]');
								$overseaTest = $dialog.find('[data-cdn-event="oversea-test-URL"]');

								$overseaName.on('input', _.debounce(function () {
									var $this = $(this)
									if (!$this.val()) {
										addErrorFlag($this, '联系人不可为空。')
										return;
									}
									removeErrorFlag($this)
								}, 500));


								$overseaTel.on('input', _.debounce(function () {
									var $this = $(this)
									if (!cdnutil.testTelPhone($this.val())) {
										addErrorFlag($this, '手机号码格式不正确。')
										return;
									}
									removeErrorFlag($this)
								}, 500));

								$overseaMail.on('input', _.debounce(function () {
									var $this = $(this)
									if (!cdnutil.testEmail($this.val())) {
										addErrorFlag($this, '邮箱地址不正确。')
										return;
									}
									removeErrorFlag($this)
								}, 500));

								$overseaHost.on('input', _.debounce(function () {
									var $this = $(this);

									var inputContent = $this.val().trim();
									if (!inputContent) {
										removeErrorFlag($this, '一行输入一个，无需填写http://或https://，还可以输入10个')
										return;
									}

									var hosts = inputContent.split('\n').filter(String).map(function (host) {
										return $.trim(host)
									})

									if (_.uniq(hosts).length != hosts.length) {
										addErrorFlag($this, '不能出现重复域名')
										return;
									}

									if (hosts.length > 10) {
										addErrorFlag($this, '域名最多只可添加10个，请删除部分域名，再添加')
										return
									}

									var isHostsInvalid = _.any(hosts, function (host) {
										return !cdnutil.testDomain(host) || host.length > 40
									})

									if (isHostsInvalid) {
										addErrorFlag($this, '域名格式错误')
										$this.closest('.form-unit').removeClass('is-success')
									} else {
										$overseaHost.data('hosts', hosts)
										removeErrorFlag($this, '一行输入一个，无需填写http://或https://，还可以输入' + (10 - hosts.length) + '个')
										$this.closest('.form-unit').addClass('is-success')
									}
								}, 500));

								$overseaBandwidth.on('input', _.debounce(function () {
									var $this = $(this);
									var val = $this.val();
									if (!/^\d{1,7}$/.test(val)) {
										addErrorFlag($this, '请输入整数值，不得超过7位数')
										return;
									}
									removeErrorFlag($this);
								}, 500));

								$overseaOrigin.on('input', _.debounce(function() {
									var $this = $(this);

									var inputContent = $this.val().trim();
									if (!inputContent) {
										removeErrorFlag($this, '还可以输入1个');
										return;
									}

									var origins = inputContent.split('\n').filter(String).map(function (origin) {
										return $.trim(origin);
									})

									if (_.uniq(origins).length != origins.length) {
										addErrorFlag($this, '不能出现重复IP/域名');
										return;
									}

									if (origins.length > 1) {
										addErrorFlag($this, 'IP/域名最多只可添加1个，请删除部分IP/域名，再添加');
										return;
									}

									if(_.contains(inputContent, ':') && inputContent.split(':')[1] !== '80') {
										addErrorFlag($this, 'IP/域名目前仅支持80端口');
										return;
									}

									var isHostsInvalid = _.any(origins, function (origin) {
										return 	!( 	cdnutil.testDomain(origin)
												|| 	cdnutil.testDomainAndPort(origin)
												|| 	cdnutil.testIp(origin)
												|| 	cdnutil.testIpAndPort(origin)
												 )
												|| 	origin.length > 40;
									})

									if (isHostsInvalid) {
										addErrorFlag($this, 'IP/域名格式错误');
										$this.closest('.form-unit').removeClass('is-success');
									} else {
										$overseaOrigin.data('origins', origins);
										removeErrorFlag($this, '一行输入一个，回车换行，还可以输入' + (1 - origins.length) + '个');
										$this.closest('.form-unit').addClass('is-success');
									}
								}, 500));

								$overseaCache.on('input', _.debounce(function() {
									var $this = $(this);
									var cachePattern = new RegExp("[`~!@#$^&()=|{}':\\<>?！￥……&（）——|【】‘；：”“’。，、？]");

									var inputContent = $this.val().trim();
									if (!inputContent) {
										addErrorFlag($this, '一行输入一条，回车换行');
										return;
									}

									if(cachePattern.test(inputContent)) {
										addErrorFlag($this, '不能出现特殊字符');
										return;
									}

									var caches = inputContent.split('\n').filter(String).map(function (cache) {
										return $.trim(cache);
									})

									if (_.uniq(caches).length != caches.length) {
										addErrorFlag($this, '不能出现重复规则');
										return;
									}

									$overseaCache.data('caches', caches);
									removeErrorFlag($this);
									$this.closest('.form-unit').addClass('is-success');

								}, 500));

								$overseaHy.on('input', _.debounce(function() {
									var $this = $(this);

									if (!cdnutil.testDomain($this.val())) {
										addErrorFlag($this, '回源host不正确');
										return;
									}
									removeErrorFlag($this);
								}, 500));

								$overseaTest.on('input', _.debounce(function() {
									var $this = $(this);

									if (!cdnutil.testUrl($this.val())) {
										addErrorFlag($this, '测试URL不正确');
										return;
									}
									removeErrorFlag($this);
								}, 500));

								applyBtnOk = function () {
									// 确保都填写了
									if ($overseaName.val() && $overseaTel.val() && $overseaMail.val() && 
									  $overseaHost.val() && $('[data-cdn-event="oversea-area"]').find(':checked').length > 0 &&
									  $overseaBandwidth.val() && $dialog.find('.form-unit.is-error').length == 0
									) {
										enableSubmit($dialog, true);
									} else {
										enableSubmit($dialog, false);
									}
								}

								$dialog.find(':input').on('input change', _.debounce(function () {
									applyBtnOk();
								}, 600))



								$overseaName.val(userBasicInfo.name).trigger('input')
								$overseaTel.val(userBasicInfo.tel).trigger('input');
								$overseaMail.val(userBasicInfo.mail).trigger('input')

							},
							button: {
								'申请': function ($btn, $dialog) {
									var areas = [];
									$('[data-cdn-event="oversea-area"]').find(':checked').each(function (idx, el) {

										areas.push($(el).data('value'))
									});
									var postdata = {
										"name": $overseaName.val(),
										"tel": $overseaTel.val(),
										"mail": $overseaMail.val(),
										"host": $overseaHost.data('hosts'),
										"area": areas,
										"service_type": $overseaServiceType.val(),
										"estimate_bandwidth": $overseaBandwidth.val(),
										"origin": $overseaOrigin.data("origins"),
										"cache_time_rule": $overseaCache.data('caches'),
										"fwd_host": $overseaHy.val(),
										"furl_cache": $overseaFilter.filter(":checked").data("value"),
										"test_url": $overseaTest.val()
									}
									overseaStat.status = OVERSEA_STAT.VERIFYING
									showBtnText(overseaStat);

									dao.add_oversea_cdn({
										data: postdata,
										success: {
											"0": function(rs) {
												overseaStat.status = OVERSEA_STAT.VERIFYING
												tips.success('海外申请已提交')
												showBtnText(overseaStat)
												dialog.hide()
											},
											"default": function(rs) {
												if (rs.msg) {
													tips.error(rs.msg);
												} else {
													tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
												}
											}
										}
									})
								}
							},
							buttonDisable: [1]

						})
					} else if (overseaStat.status == OVERSEA_STAT.VERIFYING || overseaStat.status == OVERSEA_STAT.VERIFY_FAIL) {
						dialog.create(_this.tmpl.oversea_verifying_dialog, '550', '', {
							title: '等待审核',
							"class": "dialog_layer_v2 oversea_verifying_dialog",
							defaultCancelBtn : false,
							onload: function ($dialog) {

							},
							button: {
								'知道了': function ($btn, $dialog) {
									dialog.hide();
								}
							}
						})
					} else if (overseaStat.status == OVERSEA_STAT.VERIFY_SUCCESS) {
						dialog.create(_this.tmpl.oversea_verify_success_dialog, '550', '', {
							title: '审核通过',
							"class": "dialog_layer_v2 oversea_verify_success_dialog",
							defaultCancelBtn : false,
							onload: function ($dialog) {

							},
							button: {
								'知道了': function ($btn, $dialog) {
									dialog.hide();
								}
							}
						})
					}

				})
			}
		})
	}

	function showBtnText(overseaStat) {
		var text;
		if (overseaStat.status == OVERSEA_STAT.NOT_OPEN) {
			text = '申请开通海外CDN'
		} else {
			text = '查看海外CDN申请'
		}

		$('[data-cdn-event="oversea-btn-text"]').text(text)
	}

	// 针对 dialog 库的确认按钮开关
	function enableSubmit($dialog, flag) {
		var $submitBtn = $dialog.find('.dialog_layer_ft .btn').eq(0);
		if (flag) {
			$submitBtn.removeClass('btn_unclick').addClass('btn_blue')
		} else {
			$submitBtn.removeClass('btn_blue').addClass('btn_unclick')
		}
	}

	// 海外cdn逻辑 end



	function updateListView() {
		var oldData = _this.data

		var idList = [];
		_.each(oldData.hosts, function (hostObj) {
			// 当域名处于[审核中]或者[部署中]的状态时, 才开始轮询
			if (hostObj.status == 1 || hostObj.status == 4) {
				idList.push(hostObj.host_id)
			}
		});

		if (idList.length == 0) {
			return
		}

		_updateListView(idList)
	}

	function _updateListView(idList) {
		dao.getHostList({
			data: {
				start_page: 1,
				page_limit: _this.totalLimit,
				mode: 'access',
				field: 'host'
			},
			success: {
				"0": function(rs) {
					if (rs.data.hosts && rs.data.hosts.length > 0) {
						refreshTr(idList, {data: rs.data.hosts});
						//_this.data = rs.data;
					}
				},
				"default": function(rs) {
					if (rs.msg) {
						tips.error(rs.msg);
					} else {
						tips.error("CDN系统正在繁忙中，请休息一下，稍后重试！");
					}
				}
			}
		})
	}

	/**
	 * 
	 */
	return {
		container: accessTemplate,
		render: function() {
			_this.tmpl = {

				main_2: $("[data-cdn-tmpl=main2]").html(),
				list_filter_popup: $("[data-cdn-tmpl=list_filter_popup]").html(),

				mainList: $("[data-cdn-tmpl=mainList]").html(),
				main_nolist: $("[data-cdn-tmpl=main_nolist]").html(),

				dialog_4: $("[data-cdn-tmpl=dialog_4]").html(),
				dialog_4S: $("[data-cdn-tmpl=dialog_4S]").html(),

				dialog_5: $("[data-cdn-tmpl=dialog_5]").html(),
				dialog_5S: $("[data-cdn-tmpl=dialog_5S]").html(),
				dialog_6: $("[data-cdn-tmpl=dialog_6]").html(),
				dialog_6_1: $("[data-cdn-tmpl=dialog_6_1]").html(),
				dialog_7: $("[data-cdn-tmpl=dialog_7]").html(),
				oversea_add_dialog: $('[data-cdn-tmpl="oversea_add_dialog"]').html(),
				oversea_verifying_dialog: $('[data-cdn-tmpl="oversea_verifying_dialog"]').html(),
				oversea_verify_success_dialog: $('[data-cdn-tmpl="oversea_verify_success_dialog"]').html(),
			};
			_this.$e = $(".main-wrap");
			main();
		},
		destroy: function() {
			panel.hide();
			clearInterval(refreshStatusInterval);
		}
	}
});
/*  |xGv00|f869c0e364d7c7d29a1aeee31b8331a8 */