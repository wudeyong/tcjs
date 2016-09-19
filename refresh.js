/**
* @fileOverview CDN刷新模块
* @author linktang
* @requires jQuery
* @update 2015-02-03
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var refreshTemplate = require("../../templates/refresh.html.js");
    var datepicker = require('cdn/datepicker');
    var pager = require('cdn/lib/pager');
    var dateUtil = require('cdn/lib/date');
    var tips = require('cdn/tips');
    var dialog = require('cdn/dialog');

    var _sucMsg = '您的刷新请求已提交，CDN已启动刷新队列，所有节点将在5分钟内刷新完成';
    var _preheatSucMsg = '您的预热请求已提交，CDN已启动预热队列，所有节点将在5到30分钟内预热完成';
    var _defaultErrMsg = '服务器繁忙，请稍后再试';

    var refreshLogTable;
    var datePicker;
    var intervalRefresh;

    var selectedDate = dateUtil.formatDate(new Date(), "YYYY-MM-DD");
    var logType = "url";
    var selectedPage = 1;
    var selectedStatus = "";

    var initData = function() {
        selectedDate = dateUtil.formatDate(new Date(), "YYYY-MM-DD");
        logType = "url";
        selectedPage = 1;
        selectedStatus = "";
    };
    
    var initLogTable = function() {
        var tableColums = [{
            key : 'host',
            name : '刷新记录',
            minWidth: 300
        }, {
            key : 'datetime',
            name : '刷新时间',           
        }, {
            key : 'status',
            name : '状态'
        }];

        refreshLogTable = Bee.mount('refresh_log_table', {
            $data : {
                hasFirst: false,
                canSelectTotal : false,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示
                colums : tableColums,
                maxHeightOffset : 10,// 最大高度的偏移值
                minCount: 50,
                maxCount: 50
            },
            statusOptionsRefresh: [
                {label: '全部', value: ''},
                {label: '完成', value: '2'},
                {label: '节点刷新中', value: '1'},
                {label: '失败', value: '-1'}
            ],
            statusOptionsPreheat: [
                {label: '全部', value: ''},
                {label: '预热中', value: '1'},
                {label: '完成', value: '2'},
                {label: '失败', value: '-1'}
            ],
            //实现该方法以自定义填充单元格内容
            getCellContent: function(val, item, col) {
                if(col.key === 'status') {
                    if(logType == "preheat") {
                        if (val == "process" || val == "init") {
                            return "预热中";
                        }
                        else if (val == 'done') {
                            return "完成";
                        }
                        else if (val == 'fail') {
                            return "失败";
                        }
                    }
                    else {
                        if (val == -1) {
                            return "失败";
                        }
                        else if (val == 1) {
                            return "节点刷新中";
                        }
                        else if (val == 2) {
                            return "完成";
                        }
                    }
                }
            },
            getHeadContent: function(col) {
                if(col.key === 'status') {
                    if (logType == "preheat")
                    {
                        return '<grid-view-header-filter b-ref="statusFilter" b-with="{ ready: statusFilterReady.bind(this.$root), filterOptions: statusOptionsPreheat, col: col, change: statusChange.bind(this.$root),singleMode: true }"></grid-view-header-filter>'
                    }
                    else {
                        return '<grid-view-header-filter b-ref="statusFilter" b-with="{ ready: statusFilterReady.bind(this.$root), filterOptions: statusOptionsRefresh, col: col, change: statusChange.bind(this.$root),singleMode: true }"></grid-view-header-filter>'
                    }
                }
            },

            statusFilterReady: function(filter) {

            },

            statusChange: function(options) {
                selectedStatus = options[0];
                selectedPage = 1;
                refreshLogDatas(true, false);
            },

            //翻页和排序的时候会调用
            getData: function(opts, callback) {
                selectedPage = opts.page;
                refreshLogDatas(true, true);
            }
        });
    };

    var initDatePicker = function() {
        var _defaultDateFormat = 'YYYY-MM-DD';
        var now = new Date().getTime();
        var today = dateUtil.formatDate(now - 0, _defaultDateFormat);
        var recent30 = dateUtil.formatDate(now - 24*3600*1000*29, _defaultDateFormat);
        datePicker = Bee.mount('refresh_log_datepicker', {
          $data: {
            mode: "single",
            // 是否选择日历选择器
            showCalendar: true,
            // 使用的语言包，目前支持 'zh-cn' 和 'en-us'
            lang: 'zh-cn'
            // 快捷日期选项卡
            }
        });

        datePicker.setSelectedRange(today, today);

        //只显示最近30天的数据
        datePicker.setAllowRange(recent30, today);

        datePicker.$on('datepick', function(selected) {
            selectedDate = selected.from;
        });
    };

    var initEvents = function() {
        initTabClickEvent();
        initRefreshUrlEvent();
        initRefreshMenuEvent();
        initPushUrlEvent();
        initLogBtnEvent();
        initLogSearchBtnEvent();
    };

    var initPageData = function() {
        var vipOrWhiteList = false;

        var showPreheatTab = function() {
            $('[_dn_cdn_action="resource_preheat_tab"]').css("display", "inline-block");
            $('[_dn_cdn_action="preheat_log_btn"]').removeClass("hide")
        };

        getFlushQuota().done(function(rs) {
            $('[_dn_cdn_action="url_remain_number"]').text(rs.data.url_flush.available);
            $('[_dn_cdn_action="menu_remain_number"]').text(rs.data.dir_flush.available);
            $('[_dn_cdn_action="preheat_remain_number"]').text(rs.data.url_push.available);
        }).fail(function(rs) {

        });

        checkVip().done(function(rs) {
            if (rs.data.is_vip == 1 && !vipOrWhiteList) {
                vipOrWhiteList = true;
                showPreheatTab();
            }
        }).fail(function(rs) {

        });

        checkWhiteList().done(function(rs) {
            if (rs.data['file-prefetch'].value == "on" && !vipOrWhiteList) {
                vipOrWhiteList = true;
                showPreheatTab();
            }
        }).fail(function(rs) {

        });
    };

    var initTabClickEvent = function() {
        $('[_dn_cdn_action="tab_row"] li').on("click", function(e) {
            var target = $(this);
            var hideAllTabs = function() {
                $('[_dn_cdn_action="url_refresh"]').addClass('hide');
                $('[_dn_cdn_action="menu_refresh"]').addClass('hide');
                $('[_dn_cdn_action="resource_preheat"]').addClass('hide');
                $('[_dn_cdn_action="refresh_log"]').addClass('hide');

                $('[_dn_cdn_action="url_refresh_tab"]').removeClass('tc-cur');
                $('[_dn_cdn_action="menu_refresh_tab"]').removeClass('tc-cur');
                $('[_dn_cdn_action="resource_preheat_tab"]').removeClass('tc-cur');
                $('[_dn_cdn_action="refresh_log_tab"]').removeClass('tc-cur');
            };
            hideAllTabs();
            $('[_dn_cdn_action='+ target.attr("_dn_cdn_action").match(/.+(?=_tab)/)[0] + ']').removeClass('hide');
            $('[_dn_cdn_action='+ target.attr("_dn_cdn_action") + ']').addClass('tc-cur');
        });
    };

    var initRefreshUrlEvent = function() {
        $('[_dn_cdn_action="url_refresh_btn"]').on("click", function(e) {
            var target = $(this);
            if (target.hasClass("disabled")){
                return;
            }
            target.addClass("disabled");
            var refreshUrls = $('[ _dn_cdn_action="url_input"]').val();
            refreshUrls = checkUrls(refreshUrls, $('[ _dn_cdn_action="url_refresh_error_tip"]'), "type-url");
            if (!refreshUrls)
            {
                target.removeClass("disabled");
                return;
            }
            var param = {
                url_list: refreshUrls
            };
            flushCDN(param).done(function(rs) {
                // 更新一下剩余数量
                getFlushQuota().done(function(rs) {
                    $('[_dn_cdn_action="url_remain_number"]').text(rs.data.url_flush.available);
                    $('[_dn_cdn_action="menu_remain_number"]').text(rs.data.dir_flush.available);
                    $('[_dn_cdn_action="preheat_remain_number"]').text(rs.data.url_push.available);
                }).fail(function(rs) {

                });
                // 刷新成功清空输入框
                $('[_dn_cdn_action="url_input"]').val("");
                tips.success(_sucMsg);
                target.removeClass("disabled");
            }).fail(function(rs) {
                tips.error(rs.msg || _defaultErrMsg);
                target.removeClass("disabled");
            });
        });
    };

    var initRefreshMenuEvent = function() {
        $('[_dn_cdn_action="menu_refresh_btn"]').on("click", function(e) {
            var target = $(this);
            if (target.hasClass("disabled")){
                return;
            }
            target.addClass("disabled");
            var refreshMenus = $('[ _dn_cdn_action="menu_input"]').val();
            refreshMenus = checkUrls(refreshMenus, $('[ _dn_cdn_action="menu_refresh_error_tip"]'), "type-menu");
            if (!refreshMenus)
            {
                target.removeClass("disabled");
                return;
            }
            var param = {
                dir_list: refreshMenus
            };
            flushCDN(param).done(function(rs) {
                // 更新一下剩余数量
                getFlushQuota().done(function(rs) {
                    $('[_dn_cdn_action="url_remain_number"]').text(rs.data.url_flush.available);
                    $('[_dn_cdn_action="menu_remain_number"]').text(rs.data.dir_flush.available);
                    $('[_dn_cdn_action="preheat_remain_number"]').text(rs.data.url_push.available);
                }).fail(function(rs) {

                });
                // 刷新成功清空输入框
                $('[_dn_cdn_action="menu_input"]').val("");
                tips.success(_sucMsg);
                target.removeClass("disabled");
            }).fail(function(rs) {
                tips.error(rs.msg || _defaultErrMsg);
                target.removeClass("disabled");
            });
        });
    };

    var initPushUrlEvent = function() {
        $('[_dn_cdn_action="resource_preheat_btn"]').on("click", function(e) {
            var target = $(this);
            if (target.hasClass("disabled")){
                return;
            }
            target.addClass("disabled");
            var preheatUrls = $('[ _dn_cdn_action="resource_preheat_input"]').val();
            preheatUrls = checkUrls(preheatUrls, $('[ _dn_cdn_action="resource_preheat_error_tip"]'), "type-preheat");
            if (!preheatUrls)
            {
                target.removeClass("disabled");
                return;
            }
            var param = {
                url_list: preheatUrls
            };
            pushUrls(param).done(function(rs) {
                // 更新一下剩余数量
                getFlushQuota().done(function(rs) {
                    $('[_dn_cdn_action="url_remain_number"]').text(rs.data.url_flush.available);
                    $('[_dn_cdn_action="menu_remain_number"]').text(rs.data.dir_flush.available);
                    $('[_dn_cdn_action="preheat_remain_number"]').text(rs.data.url_push.available);
                }).fail(function(rs) {

                });
                // 预热成功清空输入框
                $('[_dn_cdn_action="resource_preheat_input"]').val("");
                tips.success(_preheatSucMsg);
                target.removeClass("disabled");
            }).fail(function(rs) {
                tips.error(rs.msg || _defaultErrMsg);
                target.removeClass("disabled");
            });
        });
    };

    var initLogBtnEvent = function() {
        var uncheckedAll = function() {
            $('[_dn_cdn_action="btn_group"] button').removeClass("checked");
        };
        $('[_dn_cdn_action="btn_group"] button').on("click", function(e) {
            var target = $(this);
            var attrValue = target.attr('_dn_cdn_action');
            uncheckedAll();
            target.addClass("checked");
            if (attrValue == "url_log_btn") {
                logType = "url";
            }
            else if (attrValue == "menu_log_btn") {
                logType = "dir";
            }
            else {
                logType = "preheat";
            }
        });
    };

    var initLogSearchBtnEvent = function() {
        $('[_dn_cdn_action="log_search"]').on("click", function(e) {
            selectedPage = 1;
            selectedStatus = "";
            refreshLogDatas(true, true);
        });
    };

    // 更新日志列表
    var refreshLogDatas = function(showLoadingIcon, setColums) {
        var keyword = $.trim($('[_dn_cdn_tion="keyword_input"]').val());

        var logParam = {
            date: selectedDate,
            type: logType,
            page: selectedPage,
            limit: 50
        };
        if (keyword)
        {
            logParam.keyword = keyword;
        }
        if (selectedStatus)
        {
            logParam.status = selectedStatus;
        }
        if (logType == "preheat") {
            getPushLogs(logParam, showLoadingIcon).done(function(rs) {
                var list = [];
                rs.data.logs.forEach(function(item, index) {
                    list.push({
                        host: item.url,
                        datetime: item.datetime,
                        status: item.status
                    });
                });
                var opt = {
                    totalNum: rs.data.total,
                    page: selectedPage,
                    list: list
                };
                updateLogTable(opt, setColums);
            }).fail(function(rs) {
                tips.error(rs.msg || _defaultErrMsg);
                updateLogTable({
                    totalNum: 0,
                    page: selectedPage,
                    list: []
                }, setColums);
            });
        }
        else {
            getFlushLogs(logParam, showLoadingIcon).done(function(rs) {
                var list = [];
                rs.data.logs.forEach(function(item, index) {
                    list.push({
                        host: item.url,
                        datetime: item.datetime,
                        status: item.status
                    });
                });
                var opt = {
                    totalNum: rs.data.total,
                    page: selectedPage,
                    list: list
                };
                updateLogTable(opt, setColums);
            }).fail(function(rs) {
                tips.error(rs.msg || _defaultErrMsg);
                updateLogTable({
                    totalNum: 0,
                    page: selectedPage,
                    list: []
                }, setColums);
            });
        }
    };

    var updateLogTable = function(opt, setColums) {
        if (setColums)
        {
            if (logType == "preheat") {
                refreshLogTable.$set('colums', [{
                    key : 'host',
                    name : '预热记录',
                    minWidth: 300
                }, {
                    key : 'datetime',
                    name : '预热时间',           
                }, {
                    key : 'status',
                    name : '状态'
                }]);
            }
            else {
                refreshLogTable.$set('colums', [{
                    key : 'host',
                    name : '刷新记录',
                    minWidth: 300
                }, {
                    key : 'datetime',
                    name : '刷新时间',           
                }, {
                    key : 'status',
                    name : '状态'
                }]);
            }
        }
        refreshLogTable.setData({
            totalNum : opt.totalNum,
            page : opt.page,
            count : 50,
            list : opt.list,
            type: "reload"
        });
    };

    var checkVip = function() {
        var defer = $.Deferred();
        dao.checkCdnVip({
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var checkWhiteList = function() {
        var defer = $.Deferred();
        dao.get_white_list({
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var getFlushLogs = function(param, showLoadingIcon) {
        var defer = $.Deferred();
        dao.getFlushLogs({
            data: param,
            showLoadingIcon: showLoadingIcon,
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var getPushLogs = function(param, showLoadingIcon) {
        var defer = $.Deferred();
        dao.getPushLogs({
            data: param,
            showLoadingIcon: showLoadingIcon,
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var flushCDN = function(param) {
        var defer = $.Deferred();
        dao.flushCDN({
            data: param,
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var pushUrls = function(param) {
        var defer = $.Deferred();
        dao.pushUrls({
            data: param,
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var getFlushQuota = function() {
        var defer = $.Deferred();
        dao.get_flush_quota({
            data: {},
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    // 30秒定期刷新列表
    var initInterval = function() {
        if (intervalRefresh)
        {
            clearInterval(intervalRefresh);
        }
        intervalRefresh = setInterval(function() {
            if (window.location.href.indexOf("refresh") > -1){
                refreshLogDatas(false, true);
            }
            else {
                clearInterval(intervalRefresh);
            }
        }, 30000);
    };

    //检查URL规则，并处理输入的url列表
    var checkUrls = function(urls, target, type){
        urls = $.trim(urls);
        if(!urls){
            //判空提示
            target.text('您输入的URL格式有误:输入的URL不能为空').show();
            return false;
        }
        
        type = type || 'type-url';
        
        var arr = urls.split('\n');
        for(var i=0;i<arr.length;i++){
            var url = $.trim(arr[i]);//每个URL trim一下
            if(!url){
                arr[i] = undefined;
                continue;
            }else{
                arr[i] = url;
            }
            if(!/^(http||https)(:\/\/)(.+)(\.[^\.]+)$/gi.test(url)){
                target.text('您输入的URL格式有误，请确认后重新提交').show();
                return false;
            }
        }
        //去掉空的元素哦
        arr = $.grep(arr,function(n){
            target.hide();
            return !!n;
        });
        
        if(arr.length){
            
            if(type=='type-url' && arr.length>1000){
                target.text('输入的URL个数不能超过1000个，请删减后重新提交').show();
                return false;
            }
            
            if(type=='type-menu' && arr.length>20){
                target.text('输入的目录URL个数不能超过20个，请删减后重新提交').show();
                return false;
            }
            if(type=='type-preheat' && arr.length>20){
                target.text('输入的预热URL个数不能超过20个，请删减后重新提交').show();
                return false;
            }
            target.hide();
            return arr.join('\n');;
        }else{
            return false;
        }
    };

    return{
        container: refreshTemplate,
        render: function(){
            
        },
        init: function(){
            initData();
            initLogTable();
            initDatePicker();
            initEvents();
            initPageData();
            initInterval();
        }
    }
});/*  |xGv00|5901678e2918c67cbe39b0ee2bc94f2d */