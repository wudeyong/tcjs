/**
* @fileOverview 日志管理模块
* @author galenye
* @requires jQuery
* @update 2015-12-14
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
	var tmpl = require("cdn/lib/tmpl");
	var dateUtil = require('cdn/lib/date');
	var dao = require('cdn/data/dao');
	var dialog = require('cdn/dialog');
	var logTemplate = require("../../templates/log.html.js");
	var tips = require('cdn/tips');
	var util = require('cdn/util');

	var _defaultDateFormat = 'YYYY-MM-DD';
	var _data = {
		gridList: [],
		gridView: '',
		opts: {}
	}
	var _hostData;

	function bindEvent() {
		$('.js-input-hostname').on('click', function(e) {
			$('.js-multi-select-panel').toggle()

			return false
		})

		$('.manage-area').on('click', function(e) {
			if(!$(e.target).closest('.js-hostname-wrap').length){
				$('.js-multi-select-panel').hide()
			}
		})

		$('.js-dl-hosts').on('click', '.js-hosts-label', function(e) {
			if(e.target.tagName === 'INPUT') {
				var host = $(e.target).data('domain');
				var host_id = $(e.target).val();

				$('.js-input-hostname').val(host);
				$('#js-btn-search').data('host', host_id);

			}
		})

		$('.js-dl-hosts').on('input propertychange', '.js-hosts-search', function() {
			var host = $(this).val();
			var hostSelect = $('.js-hosts-dd-maintain');
			var searchReg = host;


			if(host !== '') {

				var res = [];
				$.each(_hostData, function(host, hostValue) {
				    if(hostValue.host && hostValue.host.indexOf(searchReg) > -1) {
				        res.push({
				            host: hostValue.host,
				            host_id: hostValue.host_id
				        });
				    }
				})
				var str = tmpl.parse($("[data-cdn-tmpl=option_hosts]").html(), {
				    data : res
				});
				hostSelect.html(str)

			}else{
				var str = tmpl.parse($("[data-cdn-tmpl=option_hosts]").html(), {
				    data : _hostData
				});
				hostSelect.html(str)
			}

			
		})

		$('.js-btn-ok').on('click', function() {
			var host = $('.js-dl-hosts input:checked').data('domain');
			var host_id = $('.js-dl-hosts input:checked').val();

			$('.js-input-hostname').val(host);
			$('#js-btn-search').data('host', host_id);

			$('.js-multi-select-panel').hide();
		})

		$('.js-btn-cancel').on('click', function() {
			$('.js-multi-select-panel').hide();
		})

		$('#js-btn-search').on('click', function() {
			renderList()
		})
	}

	function renderList() {

		var host_id = $('#js-btn-search').data('host');
		var date_from = $('#js-btn-search').data('from');
		var date_to = $('#js-btn-search').data('to');

		if (!host_id) {
			tips.error("请选择域名");
			return;
		}

		_data.opts = {
			orderField: "date", 
			order: 1, 
			page: 1, 
			count: _data.opts && _data.opts.count?_data.opts.count:20, 
			searchKey: ""
		}

		dao.getGenerateLogDownloadLlist({
			data: {
				start_date: date_from,
				end_date: date_to,
				host_id: host_id,
				gen_link: 1
			},
			success: {
				"0": function(rs) {
					var gridList = [];
					$(rs.data.list.reverse()).each(function(idx, item) {
						// item.date = dateUtil.formatDate(new Date(item.date * 1000), _defaultDateFormat);

						gridList.push({
							date: item.date,
							name: item.name,
							link: item.link,
						})
					});

					_data.gridList = gridList;

					_data.gridView.setData({
						totalNum: gridList.length,
						page : _data.opts.page,
						count : _data.opts.count,
						list : gridList.slice((_data.opts.page - 1) * _data.opts.count, _data.opts.count)
					})
				},
				"default": function(rs) {
					tips.error(rs.msg);
					_data.gridView.setData({
						totalNum : 0,
						page : 1,
						count : _data.opts.count,
						list : []
					});
				}
			}
		});
	}

	//拉取host信息
	function initHost(){

		dao.getAllHostList({
			mode: 'log',
			field: 'log'
		}, function(d){
			if(d&&d.code==0){
				var data = d.data;
				//缓存一下host信息
				_hostData = data.hosts;
				var hostStr = tmpl.parse($("[data-cdn-tmpl=option_hosts]").html(), {
					data : data.hosts
				});

				$('.js-hosts-dd-maintain').html(hostStr);
			}
		})
	}

	function initList(){

		!!_data.gridList.length && (_data.gridList = [])

		var allColums = [{
			key : 'date',
			name : '时间'
		}, {
			key : 'name',
			name : '日志数据包'
		}, {
			key : 'link',
			name : '操作'
		}];

		_data.gridView = Bee.mount('gridView', {
			$data : {
				canSelectTotal : true,// 是否允许所有项
				emptyTips : '抱歉，没有找到相关数据。',
				colums : allColums,
				maxHeightOffset : 10,
				hasFirst: false,
			},
			getCellContent: function(val, item, col) {
				if(col.key === 'link') {
					if(item.link) {
						return '<a href={{item["link"]}} title="操作：下载">下载</span>';
					}else{
						return '无数据';
					}
				}
			},
			getData: function(opts) {
				_data.opts = opts;

				_data.gridView.setData({
					totalNum : _data.gridList.length,
					page : opts.page,
					count : opts.count,
					list : _data.gridList && _data.gridList.length?_data.gridList.slice((opts.page-1)*opts.count, opts.page*opts.count):[]
				});
			}
		});
	}

	function initPicker(){
		var now = new Date().getTime();
		var today = dateUtil.formatDate(now - 0, _defaultDateFormat);
		var recent30 = dateUtil.formatDate(now - 24*3600*1000*29, _defaultDateFormat);

		var picker = Bee.mount('js-date-cont', {
		  $data: {
		  	// 是否选择日历选择器
	    	showCalendar: true,
	    	// 使用的语言包，目前支持 'zh-cn' 和 'en-us'
	    	lang: 'zh-cn',
	    	// 快捷日期选项卡
			tabs: []
	  		},
		});

		picker.setSelectedRange(recent30, today);

		//只显示最近30天的数据
		picker.setAllowRange(recent30, today);

		//选择日期之后进行一下处理
		picker.$on('datepick', function(selected) {

			var from = selected.from;
			var to = selected.to;
			$('#js-btn-search').data('from',from);
			$('#js-btn-search').data('to',to);
			var gaptime = new Date(to).getTime() - new Date(from).getTime();
			gaptime = gaptime/1000/60/60/24;//单位是天
			$('#js-btn-search').data('gaptime',gaptime);
		  
		});

		//初始化的时候默认时间是今天
		$('#js-btn-search').data('from',recent30);
		$('#js-btn-search').data('to',today);
	}

    return{
        container: logTemplate,
        init: function(){
        	initPicker();
        	
        	initList();
			
			initHost();

        	bindEvent();
        	
        }
    }
});/*  |xGv00|758372ce87dd131ac79a340e1750e46c */