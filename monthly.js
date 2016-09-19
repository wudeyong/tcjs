/**
* @fileOverview 运营月报
* @author brandonwei
* @requires jQuery
* @update 2016-03-22
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var tmpl = require("cdn/lib/tmpl");
    var util = require('cdn/lib/util');
    var dao = require('cdn/data/dao');
    var highchart = require("cdn/highcharts");
    var dateUtil = require('cdn/lib/date');
    var cdnUtil = require('cdn/util');
    var tips = require('cdn/tips');
    var monthlyTemplate = require("../../templates/monthly.html.js");

    // 模块内的作用域变量
    var trendChart;
    var trendChartData;
    var rateChart;
    var rateChartData;
    var compareChart;
    var compareChartData;

    var rateTable;
    var rateTableData;
    var compareTable;
    var compareTableData;
    var cacheTable;
    var cacheTableData;

    // 初始化所选月份
    var selectDate;
    var selectDateLastMonth;
    var timestamp;

    var _defaultErrMsg = '服务器繁忙，请稍后再试';

    // 缓存各个按钮及多选框状态
    var trendBtn = "flux";
    var trendLastMonth = false;
    var trendTop = false;
    var trendTop95 = false;
    var rateBtn = "domain";
    var rateBtnTop = "top";
    var compareBtn = "domain";
    var compareBtnTop = "top";

    // 初始化变量
    var initData = function() {
        selectDate = new Date();
        if (selectDate.getDate() > 1){
            selectDate.setMonth(selectDate.getMonth() - 1);
        }
        else {
            selectDate.setMonth(selectDate.getMonth() - 2);
        }
        selectDate.setDate(1);
        selectDateLastMonth = new Date(new Date().setMonth(selectDate.getMonth() - 1));
        trendChartData = null;
        rateChartData = null;
        compareChartData = null;
        rateTableData = null;
        compareTableData = null;
        cacheTableData = null;
        trendBtn = "flux";
        trendLastMonth = false;
        trendTop = false;
        trendTop95 = false;
        rateBtn = "domain";
        rateBtnTop = "top";
        compareBtn = "domain";
        compareBtnTop = "top";
    };


    var initDateSelect = function() {
        var dateList = [];
        var date = new Date();
        var year = date.getFullYear();
        var month = date.getMonth();
        if (date.getDate() == 1) {
            month--;
        }
        for (var i = month; date.getTime() > 1454284800000; i--) {
            if (i == 0) {
                year--;
            }
            date = new Date(new Date(date).setMonth(i - 1));
            dateList.push({ 
                "label": year + "年" + (date.getMonth() + 1) + "月",
                "value": dateUtil.formatDate(date, "YYYY-MM")
            })
        }
        var bee = Bee.mount('dateSelector', {
            $data: {
                "dateList": dateList
            },
            $afterInit: function() {
            },
            dateSelectAction: dateSelectAction
        })

        function dateSelectAction(e) {
            selectDate = new Date(bee.$refs.dateSelector.selected.value + "-01");
            selectDateLastMonth = new Date(selectDate).setMonth(selectDate.getMonth() - 1);
            refresh();
        }
    };

    var initChart = function() {
        trendChart = getTrendChart($("[_dn_cdn_action='trend_chart']"));
        trendChart.hideNoData();
        trendChart.showNoData("该月暂无数据");

        rateChart = getRateChart($("[_dn_cdn_action='rate_chart']"));
        rateChart.hideNoData();
        rateChart.showNoData("该月暂无数据");

        compareChart = getCompareChart($("[_dn_cdn_action='compare_chart']"));
        compareChart.hideNoData();
        compareChart.showNoData("该月暂无数据");
    };

    var initTable = function() {
        var rateTableColumn = [{
            key : 'domain',
            name : '域名',
            order : false,
            insist : true
        }, {
            key : 'ratio',
            name : '百分比',
            order : false,
        }, {
            key : 'expand',
            name : '消耗量',
            order : false,
        }];

        var compareTableColumn = [{
            key : 'domain',
            name : '域名',
            order : false,
            insist : true
        }, {
            key : 'expand_this_month',
            name : '本月消耗',
            order : false
        }, {
            key : 'expand_last_month',
            name : '上月消耗',
            order : false
        }, {
            key : 'month_basis',
            name : '同比'
        }, {
            key : 'ratio',
            name : '本月占比',
            order : false
        }];

        var cacheTableColumn = [{
            key : 'domain',
            name : '域名',
            order : false,
            insist : true
        }, {
            key : 'request',
            name : '请求次数',
            order : false
        }, {
            key : 'ratio',
            name : '命中率',
            order : false
        }, {
            key : 'project',
            name : '所属项目'
        }];

        rateTable = Bee.mount('flux_expend_rate', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : rateTableColumn,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                // initGetData: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    "data-id" : 'id'
                },
                showPagination: false // 是否显示分页 
            },
            getCellContent: function(val, item, col) {
                var res = val;
                if (col) {
                    if(col.key=='ratio'){
                        return '<span class="text-overflow">' +res+ '%</span>';
                    }
                    else if (col.key=='expand') {
                        if (rateChartData.pay_type == "flux") {
                            return '<span class="text-overflow">' +res + '</span>';
                        }
                        else {
                            return '<span class="text-overflow">' +res + '</span>';
                        }
                    }
                }
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = rateTableData || [];
                var page = opts.page;
                var count = opts.count;

                var order = opts.order;
                var orderField = opts.orderField;
                if (orderField) {
                    if (order == 1) {
                        res.sort(function(item1, item2) {
                            return parseFloat(item1[orderField]) - parseFloat(item2[orderField]);
                        });
                    }
                    else {
                        res.sort(function(item1, item2) {
                            return parseFloat(item2[orderField]) - parseFloat(item1[orderField]);
                        });
                    }
                }

                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, res.length),                       
                    });
                }   
            }
        }); 

        compareTable = Bee.mount('flux_expend_compare', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : compareTableColumn,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                minHeight: 550,
                // initGetData: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    "data-id" : 'id'
                },
                showPagination: false // 是否显示分页 
            },
            getCellContent: function(val, item, col) {
                var res = val;
                if (col) {
                    if(col.key=='ratio'){
                        return '<span class="text-overflow">' + res + '%</span>';
                    }
                    else if (col.key== 'month_basis') {
                        if (res == "--") {
                            return res;
                        }
                        if (res >= 0) {
                            return '<span class="text-overflow"><i class="value-up"></i>' + Math.abs(res) + '%</span>';
                        }
                        else {
                            return '<span class="text-overflow"><i class="value-down"></i>' + Math.abs(res) + '%</span>';
                        }
                    }
                    else if (col.key=='expand_this_month' || col.key=='expand_last_month') {
                        if (res == "--") {
                            return res;
                        }
                        if (compareChartData.pay_type == "flux") {
                            return '<span class="text-overflow">' +res+ '</span>';
                        }
                        else {
                            return '<span class="text-overflow">' +res+ '</span>';
                        }
                    }
                }
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = compareTableData || [];
                var page = opts.page;
                var count = opts.count;

                var order = opts.order;
                var orderField = opts.orderField;
                if (orderField) {
                    if (order == 1) {
                        res.sort(function(item1, item2) {
                            return parseFloat(item1[orderField]) - parseFloat(item2[orderField]);
                        });
                    }
                    else {
                        res.sort(function(item1, item2) {
                            return parseFloat(item2[orderField]) - parseFloat(item1[orderField]);
                        });
                    }
                }
                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, res.length),                       
                    })
                }   
            }
        });

        cacheTable = Bee.mount('flux_expend_cache', {
            $data: {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : cacheTableColumn,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                // initGetData: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    "data-id" : 'id'
                },
                showPagination: false // 是否显示分页 
            },
            getCellContent: function(val, item, col) {
                var res = val;
                if (col && col.key=='ratio') {
                    return '<span class="text-overflow">' +res+ '%</span>';
                }
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = cacheTableData || [];
                var page = opts.page;
                var count = opts.count;

                var order = opts.order;
                var orderField = opts.orderField;
                if (orderField) {
                    if (order == 1) {
                        res.sort(function(item1, item2) {
                            return parseFloat(item1[orderField]) - parseFloat(item2[orderField]);
                        });
                    }
                    else {
                        res.sort(function(item1, item2) {
                            return parseFloat(item2[orderField]) - parseFloat(item1[orderField]);
                        });
                    }
                }
                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, res.length),                       
                    })
                }   
            }
        }); 

        rateTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });

        compareTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });

        cacheTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
    };

    var initEvent = function() {
        $('[_dn_cdn_action="trend_btn"]').on("click", function(e) {
            var $target = $(e.target);
            if ($target.attr("_dn_cdn_data") == "flux") {
                // 更新缓存状态的变量值
                trendBtn = "flux";
                // 更新界面信息
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="bandwidth"]').removeClass("checked");
                $('[_dn_cdn_action="trend_top"]').addClass("hide");
                $('[_dn_cdn_action="trend_top95"]').addClass("hide");
                $('[_dn_cdn_action="trend_unit"]').html('总出流量<em class="chart-unit">（单位: ' + (trendChartData ? (trendChartData.detail_data.fluxUnit) : '--') + '）</em>');

                updateTrendChart("flux");
                if (trendLastMonth) {
                    trendChart.series[1] && trendChart.series[1].remove();
                    updateTrendChartLastM("flux");
                }

                trendChart.yAxis[0].removePlotLine("top");
                trendChart.yAxis[0].removePlotLine("top95");
            }
            else {
                // 更新缓存状态的变量值
                trendBtn = "bandwidth";
                // 更新界面信息
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="flux"]').removeClass("checked");
                $('[_dn_cdn_action="trend_top"]').removeClass("hide");
                if (rateChartData.pay_type != "flux")
                {
                    $('[_dn_cdn_action="trend_top95"]').removeClass("hide");
                }
                $('[_dn_cdn_action="trend_unit"]').html('总出带宽<em class="chart-unit">（单位: ' + (trendChartData ? (trendChartData.detail_data.bandwidthUnit) : '--') + '）</em>');

                updateTrendChart("bandwidth");
                if (trendLastMonth) {
                    trendChart.series[1] && trendChart.series[1].remove();
                    updateTrendChartLastM("bandwidth");
                }

                if (trendTop) {
                    trendChart.yAxis[0].removePlotLine("top");
                    updateTrendTopLine("top");
                }
                
                if (trendTop95) {
                    trendChart.yAxis[0].removePlotLine("top95");
                    updateTrendTopLine("top95");
                }
            }
        });

        $('[_dn_cdn_action="trend_last_month"] input').on("change", function(e) {
            var $target = $(e.target)
            if ($target.prop("checked") == true) {
                // 更新缓存状态的变量值
                trendLastMonth = true;
                // 更新界面
                updateTrendChartLastM(trendBtn);
            }
            else {
                // 更新缓存状态的变量值
                trendLastMonth = false;
                // 更新界面
                trendChart.series[1] && trendChart.series[1].remove();
            }
        });

        $('[_dn_cdn_action="trend_top"] input').on("change", function(e) {
            var $target = $(e.target)
            if ($target.prop("checked") == true) {
                // 更新缓存状态的变量值
                trendTop = true;
                // 更新界面
                updateTrendTopLine("top");
            }
            else {
                // 更新缓存状态的变量值
                trendTop = false;
                // 更新界面
                trendChart.yAxis[0].removePlotLine("top");
            }
        });

        $('[_dn_cdn_action="trend_top95"] input').on("change", function(e) {
            var $target = $(e.target)
            if ($target.prop("checked") == true) {
                // 更新缓存状态的变量值
                trendTop95 = true;
                // 更新界面
                updateTrendTopLine("top95");
            }
            else {
                // 更新缓存状态的变量值
                trendTop95 = false;
                // 更新界面
                trendChart.yAxis[0].removePlotLine("top95");
            }
        });

        $('[_dn_cdn_action="rate_btn"]').on("click", function(e) {
            var $target = $(e.target);
            var topType = $('[_dn_cdn_action="rate_btn_top"] .checked').attr("_dn_cdn_data");
            if ($target.attr("_dn_cdn_data") == "domain") {
                // 更新缓存状态的变量值
                rateBtn = "domain";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="project"]').removeClass("checked");
                updateRateChart("domain", topType);
                rateTable.setColums([{
                    key : 'domain',
                    name : '域名',
                    order : false,
                    insist : true
                }, {
                    key : 'ratio',
                    name : '流量百分比',
                    order : false,
                }, {
                    key : 'expand',
                    name : '消耗量',
                    order : false,
                }])
                if (topType == "top") {
                    updateTable(rateTable, rateTableData ? rateTableData.domainData : []);
                }
                else {
                    updateTable(rateTable, rateTableData ? rateTableData.domainData_95 : []);
                }
            }
            else{
                // 更新缓存状态的变量值
                rateBtn = "project";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="domain"]').removeClass("checked");
                updateRateChart("project", $('[_dn_cdn_action="rate_btn_top"] .checked').attr("_dn_cdn_data"));
                rateTable.setColums([{
                    key : 'id',
                    name : '项目',
                    order : false,
                    insist : true
                }, {
                    key : 'ratio',
                    name : '流量百分比',
                    order : false,
                }, {
                    key : 'expand',
                    name : '消耗量',
                    order : false,
                }])
                if (topType == "top") {
                    updateTable(rateTable, rateTableData ? rateTableData.projectData : []);
                }
                else {
                    updateTable(rateTable, rateTableData ? rateTableData.projectData_95 : []);
                }
            }
        });

        $('[_dn_cdn_action="rate_btn_top"]').on("click", function(e) {
            var $target = $(e.target);
            var keyType = $('[_dn_cdn_action="rate_btn"] .checked').attr("_dn_cdn_data");
            if ($target.attr("_dn_cdn_data") == "top") {
                // 更新缓存状态的变量值
                rateBtnTop = "top";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="top95"]').removeClass("checked");
                updateRateChart(keyType, "top");

                if (keyType == "domain") {
                    updateTable(rateTable, rateTableData ? rateTableData.domainData : []);
                }
                else {
                    updateTable(rateTable, rateTableData ? rateTableData.projectData : []);
                }
            }
            else {
                // 更新缓存状态的变量值
                rateBtnTop = "top95";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="top"]').removeClass("checked");
                updateRateChart(keyType, "top95");

                if (keyType == "domain") {
                    updateTable(rateTable, rateTableData ? rateTableData.domainData_95 : []);
                }
                else {
                    updateTable(rateTable, rateTableData ? rateTableData.projectData_95 : []);
                }
            }
        });

        $('[_dn_cdn_action="compare_btn"]').on("click", function(e) {
            var $target = $(e.target);
            var topType = $('[_dn_cdn_action="compare_btn_top"] .checked').attr("_dn_cdn_data");
            if ($target.attr("_dn_cdn_data") == "domain") {
                // 更新缓存状态的变量值
                compareBtn = "domain";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="project"]').removeClass("checked");
                if (compareChartData.pay_type == "flux") {
                    $('[_dn_cdn_action="compare_unit"]').html('总出流量<em class="chart-unit">（单位: ' + (compareChartData ? (compareChartData.domainUnit) : '--') + '）</em>');
                }
                else
                {
                    $('[_dn_cdn_action="compare_unit"]').html('总出带宽<em class="chart-unit">（单位: ' + (compareChartData ? (compareChartData.domainUnit) : '--') + '）</em>');
                }
                updateCompareChart("domain", topType);
                compareTable.setColums([{
                    key : 'domain',
                    name : '域名',
                    order : false,
                    insist : true
                }, {
                    key : 'expand_this_month',
                    name : '本月消耗',
                    order : false
                }, {
                    key : 'expand_last_month',
                    name : '上月消耗',
                    order : false
                }, {
                    key : 'month_basis',
                    name : '同比'
                }, {
                    key : 'ratio',
                    name : '本月占比',
                    order : false
                }]);
                if (topType == "top") {
                    updateTable(compareTable, compareTableData ? compareTableData.domainData : []);
                }
                else {
                    updateTable(compareTable, compareTableData ? compareTableData.domainData_95 : []);
                }
            }
            else{
                // 更新缓存状态的变量值
                compareBtn = "project";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="domain"]').removeClass("checked");
                updateCompareChart("project", $('[_dn_cdn_action="rate_btn_top"] .checked').attr("_dn_cdn_data"));
                if (compareChartData.pay_type == "flux") {
                    $('[_dn_cdn_action="compare_unit"]').html('总出流量<em class="chart-unit">（单位: ' + (compareChartData ? (compareChartData.projectUnit) : '--') + '）</em>');
                }
                else
                {
                    $('[_dn_cdn_action="compare_unit"]').html('总出带宽<em class="chart-unit">（单位: ' + (compareChartData ? (compareChartData.projectUnit) : '--') + '）</em>');
                }
                compareTable.setColums([{
                    key : 'id',
                    name : '项目',
                    order : false,
                    insist : true
                }, {
                    key : 'expand_this_month',
                    name : '本月消耗',
                    order : false
                }, {
                    key : 'expand_last_month',
                    name : '上月消耗',
                    order : false
                }, {
                    key : 'month_basis',
                    name : '同比'
                }, {
                    key : 'ratio',
                    name : '本月占比',
                    order : false
                }]);
                if (topType == "top") {
                    updateTable(compareTable, compareTableData ? compareTableData.projectData : []);
                }
                else {
                    updateTable(compareTable, compareTableData ? compareTableData.projectData_95 : []);
                }
            }
        });

        $('[_dn_cdn_action="compare_btn_top"]').on("click", function(e) {
            var $target = $(e.target);
            var keyType = $('[_dn_cdn_action="compare_btn"] .checked').attr("_dn_cdn_data");
            if ($target.attr("_dn_cdn_data") == "top") {
                // 更新缓存状态的变量值
                compareBtnTop = "top";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="top95"]').removeClass("checked");
                updateCompareChart(keyType, "top");

                if (keyType == "domain") {
                    updateTable(compareTable, compareTableData ? compareTableData.domainData : []);
                }
                else {
                    updateTable(compareTable, compareTableData ? compareTableData.projectData : []);
                }
            }
            else {
                // 更新缓存状态的变量值
                compareBtnTop = "top95";
                // 更新界面
                $target.addClass("checked");
                $target.parent().find('[_dn_cdn_data="top"]').removeClass("checked");
                updateCompareChart(keyType, "top95");

                if (keyType == "domain") {
                    updateTable(compareTable, compareTableData ? compareTableData.domainData_95 : []);
                }
                else {
                    updateTable(compareTable, compareTableData ? compareTableData.projectData_95 : []);
                }
            }
        });

        $('.download-icon').on("click", function(e) {
            var $target = $(e.target);
            var action = $target.attr("_dn_cdn_action");
            if (action == "trend_download") {
                var endDate = new Date(selectDate).setMonth(selectDate.getMonth() + 1);
                endDate = new Date(endDate - 24 * 60 * 60 * 1000);
                $target.attr("href", CDN.FormSender.serverUrl + CDN.FormSender.commonPath + "action=download_usage_stat_data&_format=jsonp&g_tk=" + cdnUtil.getACSRFToken() + "&start_date=" + dateUtil.formatDate(selectDate, "YYYY-MM-DD") + "&end_date=" + dateUtil.formatDate(endDate, "YYYY-MM-DD") + "&view=time&_=" + new Date().getTime());
            }
            else if (action == "rate_download") {
                $target.attr("href", CDN.FormSender.serverUrl + CDN.FormSender.commonPath + "action=download_month_stat_data&view=detail&month=" + dateUtil.formatDate(selectDate, "YYYYMM") + "&g_tk=" + cdnUtil.getACSRFToken() + "&_=" + new Date().getTime());
            }
            else if (action == "compare_download") {
                $target.attr("href", CDN.FormSender.serverUrl + CDN.FormSender.commonPath + "action=download_month_stat_data&view=compare&month=" + dateUtil.formatDate(selectDate, "YYYYMM") + "&g_tk=" + cdnUtil.getACSRFToken() + "&_=" + new Date().getTime())
            }
            else if (action == "cache_download") {
                $target.parent().attr("href", CDN.FormSender.serverUrl + CDN.FormSender.commonPath + "action=download_month_stat_data&view=cache&month=" + dateUtil.formatDate(selectDate, "YYYYMM") + "&g_tk=" + cdnUtil.getACSRFToken() + "&_=" + new Date().getTime())
            }
        });
    };

    var refresh = function() {
        var month = dateUtil.formatDate(selectDate, "YYYYMM");
        timestamp = selectDate.getTime();
        // 界面月份显示设置
        $('[ _dn_cdn_data="month"]').text(selectDate.getMonth() + 1);

        var trentParam = {
            month: month,
            view: "overall"
        };

        var rateParam = {
            month: month,
            view: "detail",
            count: 5
        };

        var compareParam = {
            month: month,
            view: "compare",
            count: 10
        };

        var cacheParam = {
            month: month,
            view: "cache",
            count: 3
        };

        // 整体趋势
        getMonthStatData(trentParam).done(function(rs) {
            // 缓存数据
            trendChartData = rs.data;
            var maxFlux = 0;
            $.each(trendChartData.detail_data.flux, function(key, value) {
                if (maxFlux < value)
                {
                    maxFlux = value;
                }
            });
            var properNumFlux = util.unitConvert("flux", maxFlux, "", timestamp);
            var properNumBandwidth = util.unitConvert("bandwidth", trendChartData.bandwidth.num, "", timestamp);
            trendChartData.detail_data.fluxUnit = properNumFlux.unit;
            trendChartData.detail_data.bandwidthUnit = properNumBandwidth.unit;
            // 转换成可展示的数据结构
            trendChartData.detail_data.bandwidthArr = $.map(trendChartData.detail_data.bandwidth, function(item) {
                return util.unitConvert("bandwidth", item, properNumBandwidth.unit, timestamp).num;
            });
            trendChartData.detail_data.fluxArr = $.map(trendChartData.detail_data.flux, function(item) {
                return util.unitConvert("flux", item, properNumFlux.unit, timestamp).num;
            });
            trendChartData.pre_detail_data.bandwidthArr = $.map(trendChartData.pre_detail_data.bandwidth, function(item) {
                return util.unitConvert("bandwidth", item, properNumBandwidth.unit, timestamp).num;
            });
            trendChartData.pre_detail_data.fluxArr = $.map(trendChartData.pre_detail_data.flux, function(item) {
                return util.unitConvert("flux", item, properNumFlux.unit, timestamp).num;
            });
            // 判断有无95数据
            if (trendChartData.bandwidth_95 && trendBtn == "bandwidth") {
                $('[_dn_cdn_action="trend_top95"]').removeClass("hide");
            }

            // 更新界面显示的单位
            if (trendBtn == "flux") {
                $('[_dn_cdn_action="trend_unit"]').html('总出流量<em class="chart-unit">（单位: ' + trendChartData.detail_data.fluxUnit + '）</em>');
            }
            else {
                $('[_dn_cdn_action="trend_unit"]').html('总出带宽<em class="chart-unit">（单位: ' + trendChartData.detail_data.bandwidthUnit + '）</em>');
            }

            // 根据当前选择的状态更新内容
            // 删除原线
            trendChart.yAxis[0].removePlotLine("top");
            trendChart.yAxis[0].removePlotLine("top95");
            trendChart.series[1] && trendChart.series[1].remove();
            // 更新数据
            updateTrendChart(trendBtn);
            if (trendLastMonth) {
                updateTrendChartLastM(trendBtn)
            }
            if (trendTop && trendBtn == "bandwidth") {
                updateTrendTopLine("top");
            }
            if (trendTop95 && trendBtn == "bandwidth") {
                updateTrendTopLine("top95");
            }
            updateTrendPanel();
        }).fail(function() {
            trendChartData = null;
            $('[_dn_cdn_action="trend_unit"]').html('<em class="chart-unit">（单位: --）</em>');
            updateTrendPanel();
            trendChart.series[0].update({
                data: [],
                name: ""
            });
            trendChart.series[1] && trendChart.series[1].remove();
            trendChart.yAxis[0].removePlotLine("top");
            trendChart.yAxis[0].removePlotLine("top95");
            trendChart.hideNoData();
            trendChart.showNoData("CDN数据库繁忙，请稍后再试");
        });

        // 流量使用百分比
        getMonthStatData(rateParam).done(function(rs) {
            rateChartData = rs.data;
            var properNumDomain;
            var properNumProject 
            if (rateChartData.pay_type == "flux") {
                $('[_dn_cdn_action="trend_top95"]').addClass("hide");
                $('[_dn_cdn_action="rate_btn_top"]').addClass("hide");
                $('[_dn_cdn_action="pay_type"]').text("TOP5流量使用百分比");
                $('[_dn_cdn_action="pay_type_head"]').text("（按流量计费）");
                properNumDomain = util.unitConvert("flux", rateChartData.domain.flux[0] ? rateChartData.domain.flux[0].total_flux_out : 0, "", timestamp);
                properNumProject = util.unitConvert("flux", rateChartData.project.flux[0] ? rateChartData.project.flux[0].total_flux_out : 0, "", timestamp);
                rateChartData.domainMapData = $.map(rateChartData.domain.flux, function(item) {
                    return [[item.host, (item.flux_percent / 100).toFixed(1) * 1]];
                });
                rateChartData.projectMapData = $.map(rateChartData.project.flux, function(item) {
                    return [[rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目", (item.flux_percent / 100).toFixed(1) * 1]];
                });
                rateTableData = {};
                rateTableData.domainData = $.map(rateChartData.domain.flux, function(item) {
                    var properNumber = util.unitConvert("flux", item.total_flux_out, "", timestamp);
                    return {
                        domain: item.host,
                        ratio: (item.flux_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });
                rateTableData.projectData = $.map(rateChartData.project.flux, function(item) {
                    var properNumber = util.unitConvert("flux", item.total_flux_out, "", timestamp);
                    return {
                        id: rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目",
                        ratio: (item.flux_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });
                // 根据当前选择的状态更新内容
                updateRateChart(rateBtn, rateBtnTop);
                if (rateBtn == "domain") {
                    updateTable(rateTable, rateTableData.domainData);
                }
                else {
                    updateTable(rateTable, rateTableData.projectData);
                }
            }
            else {
                $('[_dn_cdn_action="pay_type"]').text("TOP5带宽使用百分比");
                $('[_dn_cdn_action="pay_type_head"]').text("（按带宽计费）");
                properNumDomain = util.unitConvert("bandwidth", rateChartData.domain.bandwidth[0] ? rateChartData.domain.bandwidth[0].bandwidth : 0, "", timestamp);
                properNumProject = util.unitConvert("bandwidth", rateChartData.project.bandwidth[0] ? rateChartData.project.bandwidth[0].bandwidth : 0, "", timestamp);
                rateChartData.domainMapData = $.map(rateChartData.domain.bandwidth, function(item) {
                    return [[item.host, (item.bandwidth_percent / 100).toFixed(1) * 1]];
                });
                rateChartData.domainMapData_95 = $.map(rateChartData.domain.bandwidth_95 || [], function(item) {
                    return [[item.host, (item.bandwidth95_percent / 100).toFixed(1) * 1]];
                });
                rateChartData.projectMapData = $.map(rateChartData.project.bandwidth, function(item) {
                    return [[rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目", (item.bandwidth_percent / 100).toFixed(1) * 1]];
                });
                rateChartData.projectMapData_95 = $.map(rateChartData.project.bandwidth_95 || [], function(item) {
                    return [[rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目", (item.bandwidth95_percent / 100).toFixed(1) * 1]];
                });

                rateTableData = {};
                rateTableData.domainData = $.map(rateChartData.domain.bandwidth, function(item) {
                    var properNumber = util.unitConvert("bandwidth", item.bandwidth, "", timestamp);
                    return {
                        domain: item.host,
                        ratio: (item.bandwidth_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });
                rateTableData.domainData_95 = $.map(rateChartData.domain.bandwidth_95 || [], function(item) {
                    var properNumber = util.unitConvert("bandwidth", item.bandwidth_95, "", timestamp);
                    return {
                        domain: item.host,
                        ratio: (item.bandwidth95_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });
                rateTableData.projectData = $.map(rateChartData.project.bandwidth, function(item) {
                    var properNumber = util.unitConvert("bandwidth", item.bandwidth, "", timestamp);
                    return {
                        id: rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目",
                        ratio: (item.bandwidth_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });
                rateTableData.projectData_95 = $.map(rateChartData.project.bandwidth_95 || [], function(item) {
                    var properNumber = util.unitConvert("bandwidth", item.bandwidth_95, "", timestamp);
                    return {
                        id: rateChartData.projects[item.project_id] ? rateChartData.projects[item.project_id].name : "已删除的项目",
                        ratio: (item.bandwidth95_percent / 100).toFixed(1) * 1,
                        expand: properNumber.num + properNumber.unit
                    };
                });

                if (rateChartData.domain.bandwidth_95) {
                    $('[_dn_cdn_action="rate_btn_top"]').removeClass("hide");
                }

                // 根据当前选择的状态更新内容
                updateRateChart(rateBtn, rateBtnTop);
                if (rateBtn == "domain" && rateBtnTop == "top") {
                    updateTable(rateTable, rateTableData.domainData);
                }
                else if (rateBtn == "domain" && rateBtnTop == "top95") {
                    updateTable(rateTable, rateTableData.domainData_95);
                }
                else if (rateBtn == "project" && rateBtnTop == "top") {
                    updateTable(rateTable, rateTableData.projectData);
                }
                else {
                    updateTable(rateTable, rateTableData.projectData_95);
                }
            }
            

            $('[_dn_cdn_action="domain_num"]').text(rateChartData.domain_num + "个");
            $('[_dn_cdn_action="project_num"]').text(rateChartData.project_num + "个");
        }).fail(function() {
            rateChartData = null;
            rateTableData = null;
            $('[_dn_cdn_action="domain_num"]').text("--");
            $('[_dn_cdn_action="project_num"]').text("--");
            rateChart.series[0].update({
                data : [],
                showInLegend: false,
                name : ""
            });
            rateChart.hideNoData();
            rateChart.showNoData("CDN数据库繁忙，请稍后再试");
            updateTable(rateTable, []);
        });

        // 用量详情对比
        getMonthStatData(compareParam).done(function(rs) {
            compareChartData = rs.data;
            compareTableData = {};
            var properNumDomain;
            var properNumProject;
            if (compareChartData.pay_type == "flux") {
                properNumDomain = util.unitConvert("flux", compareChartData.domain.flux[0] ? compareChartData.domain.flux[0].total_flux_out : 0, "", timestamp);
                properNumProject = util.unitConvert("flux", compareChartData.project.flux[0] ? compareChartData.project.flux[0].total_flux_out : 0, "", timestamp);
                compareChartData.domainUnit = properNumDomain.unit;
                compareChartData.projectUnit = properNumProject.unit;
                $('[_dn_cdn_action="compare_unit"]').html('总出流量<em class="chart-unit">（单位: ' + compareChartData[compareBtn + "Unit"] + '）</em>');
                $('[_dn_cdn_action="compare_btn_top"]').addClass("hide");
                compareChartData.domainFluxArrThisM = $.map(compareChartData.domain.flux, function(item) {
                    return util.unitConvert("flux", item.total_flux_out, properNumDomain.unit, timestamp).num;
                });
                compareChartData.domainFluxArrLastM = $.map(compareChartData.domain.flux, function(item) {
                    if (item.pre_total_flux_out == null) {
                        return "--"
                    }
                    return util.unitConvert("flux", item.pre_total_flux_out, properNumDomain.unit, timestamp).num;
                });
                compareChartData.projectFluxArrThisM = $.map(compareChartData.project.flux, function(item) {
                    return util.unitConvert("flux", item.total_flux_out, properNumProject.unit, timestamp).num;
                });
                compareChartData.projectFluxArrLastM = $.map(compareChartData.project.flux, function(item) {
                    if (item.pre_total_flux_out == null) {
                        return "--"
                    }
                    return util.unitConvert("flux", item.pre_total_flux_out, properNumProject.unit, timestamp).num;
                });
                compareChartData.domainArr = $.map(compareChartData.domain.flux, function(item) {
                    return item.host;
                });
                compareChartData.projectArr = $.map(compareChartData.project.flux, function(item) {
                    return compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目";
                });

                compareTableData.domainData = $.map(compareChartData.domain.flux, function(item) {
                    var properNumberThisM = util.unitConvert("flux", item.total_flux_out);
                    var properNumberLastM = item.pre_total_flux_out == null ? "--" : util.unitConvert("flux", item.pre_total_flux_out, "", timestamp);
                    return {
                        domain: item.host,
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: item.flux_cmp == null ? "--" : (+item.flux_cmp / 100).toFixed(1) * 1,
                        ratio: (item.flux_percent / 100).toFixed(1) * 1
                    };
                });
                compareTableData.projectData = $.map(compareChartData.project.flux, function(item) {
                    var properNumberThisM = util.unitConvert("flux", item.total_flux_out, "", timestamp);
                    var properNumberLastM = item.pre_total_flux_out == null ? "--" : util.unitConvert("flux", item.pre_total_flux_out, "", timestamp);
                    return {
                        id: compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目",
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: item.flux_cmp == null ? "--" : (+item.flux_cmp / 100).toFixed(1) * 1,
                        ratio: (item.flux_percent / 100).toFixed(1) * 1
                    };
                });

                // 根据当前选择的状态更新内容
                updateCompareChart(compareBtn, compareBtnTop);
                if (compareBtn == "domain") {
                    updateTable(compareTable, compareTableData.domainData);
                }
                else {
                    updateTable(compareTable, compareTableData.projectData);
                }

            }
            else {
                properNumDomain = util.unitConvert("bandwidth", compareChartData.domain.bandwidth[0] ? compareChartData.domain.bandwidth[0].bandwidth : 0, "", timestamp);
                properNumProject = util.unitConvert("bandwidth", compareChartData.project.bandwidth[0] ? compareChartData.project.bandwidth[0].bandwidth : 0, "", timestamp);
                compareChartData.domainUnit = properNumDomain.unit;
                compareChartData.projectUnit = properNumProject.unit;
                $('[_dn_cdn_action="compare_unit"]').html('总出带宽<em class="chart-unit">（单位: ' + compareChartData[compareBtn + "Unit"] + '）</em>');
                compareChartData.domainBandwidthArrThisM = $.map(compareChartData.domain.bandwidth, function(item) {
                    return util.unitConvert("bandwidth", item.bandwidth, properNumDomain.unit, timestamp).num;
                });
                compareChartData.domainBandwidthArrLastM = $.map(compareChartData.domain.bandwidth, function(item) {
                    if (item.pre_bandwidth == null) {
                        return "--"
                    }
                    return util.unitConvert("bandwidth", item.pre_bandwidth, properNumDomain.unit, timestamp).num;
                });
                compareChartData.domainBandwidthArrThisM_95 = $.map(compareChartData.domain.bandwidth_95 || [], function(item) {
                    return util.unitConvert("bandwidth", item.bandwidth_95, properNumDomain.unit, timestamp).num;
                });
                compareChartData.domainBandwidthArrLastM_95 = $.map(compareChartData.domain.bandwidth_95 || [], function(item) {
                    if (item.pre_bandwidth_95 == null) {
                        return "--"
                    }
                    return util.unitConvert("bandwidth", item.pre_bandwidth_95, properNumDomain.unit, timestamp).num;
                });
                compareChartData.projectBandwidthArrThisM = $.map(compareChartData.project.bandwidth, function(item) {
                    return util.unitConvert("bandwidth", item.bandwidth, properNumProject.unit, timestamp).num;
                });
                compareChartData.projectBandwidthArrLastM = $.map(compareChartData.project.bandwidth, function(item) {
                    if (item.pre_bandwidth == null) {
                        return "--"
                    }
                    return util.unitConvert("bandwidth", item.pre_bandwidth, properNumProject.unit, timestamp).num;
                });
                compareChartData.projectBandwidthArrThisM_95 = $.map(compareChartData.project.bandwidth_95 || [], function(item) {
                    return util.unitConvert("bandwidth", item.bandwidth_95, properNumProject.unit, timestamp).num;
                });
                compareChartData.projectBandwidthArrLastM_95 = $.map(compareChartData.project.bandwidth_95 || [], function(item) {
                    if (item.pre_bandwidth_95 == null) {
                        return "--"
                    }
                    return util.unitConvert("bandwidth", item.pre_bandwidth_95, properNumProject.unit, timestamp).num;
                });
                compareChartData.domainArr = $.map(compareChartData.domain.bandwidth, function(item) {
                    return item.host;
                });
                compareChartData.domainArr95 = $.map(compareChartData.domain.bandwidth_95, function(item) {
                    return item.host;
                });
                compareChartData.projectArr = $.map(compareChartData.project.bandwidth, function(item) {
                    return compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目";
                });
                compareChartData.projectArr95 = $.map(compareChartData.project.bandwidth_95, function(item) {
                    return compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目";
                });

                compareTableData.domainData = $.map(compareChartData.domain.bandwidth, function(item) {
                    var properNumberThisM = util.unitConvert("bandwidth", item.bandwidth, "", timestamp);
                    var properNumberLastM = item.pre_bandwidth == null ? "--" : util.unitConvert("bandwidth", item.pre_bandwidth, "", timestamp);
                    return {
                        domain: item.host,
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: (+item.bandwidth_cmp / 100).toFixed(1) * 1,
                        ratio: (item.bandwidth_percent / 100).toFixed(1) * 1
                    };
                });
                compareTableData.domainData_95 = $.map(compareChartData.domain.bandwidth_95, function(item) {
                    var properNumberThisM = util.unitConvert("bandwidth", item.bandwidth_95, "", timestamp);
                    var properNumberLastM = item.pre_bandwidth_95 == null ? "--" : util.unitConvert("bandwidth", item.pre_bandwidth_95, "", timestamp);
                    return {
                        domain: item.host,
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: (+item.bandwidth95_cmp / 100).toFixed(1) * 1,
                        ratio: (item.bandwidth95_percent / 100).toFixed(1) * 1
                    };
                });
                compareTableData.projectData = $.map(compareChartData.project.bandwidth, function(item) {
                    var properNumberThisM = util.unitConvert("bandwidth", item.bandwidth, "", timestamp);
                    var properNumberLastM = item.pre_bandwidth == null ? "--" : util.unitConvert("bandwidth", item.pre_bandwidth, "", timestamp);
                    return {
                        id: compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目",
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: (+item.bandwidth_cmp / 100).toFixed(1) * 1,
                        ratio: (item.bandwidth_percent / 100).toFixed(1) * 1
                    };
                });
                compareTableData.projectData_95 = $.map(compareChartData.project.bandwidth_95, function(item) {
                    var properNumberThisM = util.unitConvert("bandwidth", item.bandwidth_95, "", timestamp);
                    var properNumberLastM = item.pre_bandwidth_95 == null ? "--" : util.unitConvert("bandwidth", item.pre_bandwidth_95, "", timestamp);
                    return {
                        id: compareChartData.projects[item.project_id] ? compareChartData.projects[item.project_id].name : "已删除的项目",
                        expand_this_month: properNumberThisM.num + properNumberThisM.unit,
                        expand_last_month: properNumberLastM == "--" ? properNumberLastM : properNumberLastM.num + properNumberLastM.unit,
                        month_basis: (+item.bandwidth95_cmp / 100).toFixed(1) * 1,
                        ratio: (item.bandwidth95_percent / 100).toFixed(1) * 1
                    };
                });

                if (compareChartData.domain.bandwidth_95) {
                    $('[_dn_cdn_action="compare_btn_top"]').removeClass("hide");
                }
                // 根据当前选择的状态更新内容
                updateCompareChart(compareBtn, compareBtnTop);
                if (compareBtn == "domain" && compareBtnTop == "top") {
                    updateTable(compareTable, compareTableData.domainData);
                }
                else if (compareBtn == "domain" && compareBtnTop == "top95") {
                    updateTable(compareTable, compareTableData.domainData_95);
                }
                else if (compareBtn == "project" && compareBtnTop == "top") {
                    updateTable(compareTable, compareTableData.projectData);
                }
                else {
                    updateTable(compareTable, compareTableData.projectData_95);
                }
            }
        }).fail(function() {
            compareChartData = null;
            compareTableData = null;
            $('[_dn_cdn_action="compare_unit"]').html('<em class="chart-unit">（单位: --）</em>');
            compareChart.series[0].update({
                data: [],
                name: ""
            });
            compareChart.series[1].update({
                data: [],
                name: ""
            });
            compareChart.hideNoData();
            compareChart.showNoData("CDN数据库繁忙，请稍后再试");
            updateTable(compareTable, []);
        });

        
        getMonthStatData(cacheParam).done(function(rs) {
            cacheTableData = rs.data;
            cacheTableData.tableData = $.map(cacheTableData.domain_cache, function(item) {
                return {
                    domain: item.host,
                    request: item.total_request,
                    ratio: (+item.cache / 100).toFixed(1) * 1,
                    project: cacheTableData.projects[item.project_id] ? cacheTableData.projects[item.project_id].name : "已删除的项目"
                }
            });
            updateCachePanel();
            updateTable(cacheTable, cacheTableData.tableData);
        }).fail(function() {
            cacheTableData = null;
            updateCachePanel();
            updateTable(cacheTable, []);
        });
    };

    var getTrendChart = function(cont) {
        var x,y;
        x = {
            dateTimeLabelFormats:{
                day: '%e日'
            },
            type: 'datetime',
            tickInterval: 24*60*60*1000 //默认一天
        };

        y = {
            title: {
                text: ''
                
            },
            min:0,
            labels: {
                formatter: function() {
                    return this.value;
                }
            },
            allowDecimals: false
        };
        
        var chart = cont.highcharts({
            chart: {
                type: 'line',
                height: 370
            },
            credits: {
                enabled: false//去掉logo
            },
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            legend: {
                itemDistance: 50
            },
            xAxis: x,
            yAxis: y,
            tooltip: {
            },
            plotOptions: {
                line: {
                    pointInterval: 24*60*60*1000,//默认一天
                    marker: {
                        enabled: false,
                        symbol: 'circle',
                        radius: 0,
                        states: {
                            hover: {
                                enabled: false
                            }
                        }
                    },
                    events: {
                        legendItemClick: function () {
                            return false; 
                        }
                    }
                }
            },
            series: [{
                name: '',
                data: []
            }]
        });
        
        return chart.highcharts();
    };

    var getRateChart = function(cont,name) {
        var chart = cont.highcharts({
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false,
                type: 'pie'
            },
            credits: {
                enabled: false//去掉logo
            },
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            xAxis: {
                categories: [
                    
                ]
            },
            yAxis: {
                min: 0,
                title: {
                    text: ''
                }
            },
            tooltip: {
                headerFormat: '域名: <b>{point.key}</b><br/>',
                pointFormat: '占比: <b>{point.y}%</b><br/>',
                shared: true
            },
            plotOptions: {
                column: {
                    pointPadding: 0.2,
                    borderWidth: 0,
                    events: {
                        legendItemClick: function () {
                            return false; 
                        }
                    }
                }
            },
            legend : {
                enabled: false
            },
            series: [{
                name: 'domain',
                data: [],
                dataLabels: {
                    enabled: false
                }
            }]
        });
        return chart.highcharts();
    };

    var getCompareChart = function(cont) {
        var chart = cont.highcharts({
            chart: {
                type: 'column'
            },
            credits: {
                enabled: false//去掉logo
            },
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            xAxis: {
                categories: [
                    
                ]
            },
            yAxis: {
                min: 0,
                title: {
                    text: ''
                }
            },
            tooltip: {
                //enabled:false
                shared: true
            },
            plotOptions: {
                column: {
                    pointPadding: 0.2,
                    borderWidth: 0,
                    events: {
                        legendItemClick: function () {
                            return false; 
                        }
                    }
                }
            },
            series: [{
                name: '',
                data: []
            }, {
                name: '',
                data: []
            }]
        });
        return chart.highcharts();
    };

    var updateTrendChart = function(type) {
        if (!trendChartData)
        {
            return;
        }
        trendChart.options.tooltip.formatter = function(argument) {
            if (trendBtn == "flux") {
                return '<b>' + this.series.name +Highcharts.dateFormat('-%e', this.x)+'</b><br/>'+'<b>'+(this.y)+trendChartData.detail_data.fluxUnit+'</b>';
            }
            else {
                return '<b>' + this.series.name +Highcharts.dateFormat('-%e', this.x)+'</b><br/>'+'<b>'+(this.y)+trendChartData.detail_data.bandwidthUnit+'</b>';
            }
        };
        trendChart.series[0].update({
            data: type == "flux" ? trendChartData.detail_data.fluxArr : trendChartData.detail_data.bandwidthArr,
            pointStart: dateUtil.getUTCDateFromStr(dateUtil.formatDate(new Date("2016/12/01"), "YYYY-MM-DD") + " 00:00:00"),
            name: dateUtil.formatDate(new Date(selectDate), "YYYY-MM")
        });
    };

    var updateTrendChartLastM = function(type) {
        if (!trendChartData)
        {
            return;
        }
        trendChart.addSeries({
            data : type == "flux" ? trendChartData.pre_detail_data.fluxArr : trendChartData.pre_detail_data.bandwidthArr,
            pointStart : dateUtil.getUTCDateFromStr(dateUtil.formatDate(new Date("2016/12/01"), "YYYY-MM-DD") + " 00:00:00"),
            name: dateUtil.formatDate(new Date(selectDateLastMonth), "YYYY-MM"),
            color: "#434348"
        });
    };

    var updateTrendPanel = function() {
        // 该月份没有数据的时候，则显示"--"
        if (!trendChartData)
        {
            $('[_dn_cdn_action="flux"]').text("--");
            $('[_dn_cdn_action="bandwidth"]').text("--");
            $('[_dn_cdn_action="flux_basis"]').text("--");
            $('[_dn_cdn_action="bandwidth_basis"]').text("--");
            return;
        }
        var properNumFlux = util.unitConvert("flux", trendChartData.flux.num, "", timestamp);
        var properNumBandwidth = util.unitConvert("bandwidth", trendChartData.bandwidth.num, "", timestamp);
        $('[_dn_cdn_action="flux"]').text(properNumFlux.num + properNumFlux.unit);
        $('[_dn_cdn_action="bandwidth"]').text(properNumBandwidth.num + properNumBandwidth.unit);
        if (trendChartData.flux.cmp >= 0) {
            $('[_dn_cdn_action="flux_basis"]').html('<i class="value-up"></i>' + (trendChartData.flux.cmp / 100).toFixed(1) + '%');
        }
        else {
            $('[_dn_cdn_action="flux_basis"]').html('<i class="value-down"></i>' + (trendChartData.flux.cmp / 100).toFixed(1) + '%');
        }
        
        if (trendChartData.bandwidth.cmp >= 0) {
            $('[_dn_cdn_action="bandwidth_basis"]').html('<i class="value-up"></i>' + (trendChartData.bandwidth.cmp / 100).toFixed(1) + '%');
        }
        else {
            $('[_dn_cdn_action="bandwidth_basis"]').html('<i class="value-down"></i>' + (trendChartData.bandwidth.cmp / 100).toFixed(1) + '%');
        }
    };

    var updateTrendTopLine = function(type) {
        if (!trendChartData) {
            return;
        }
        var text;
        var properNum;
        if (type == "top") {
            text = "峰值带宽：";
            properNum = util.unitConvert("bandwidth", trendChartData.bandwidth.num, trendChartData.detail_data.bandwidthUnit, timestamp);
        }
        else {
            if (!trendChartData.bandwidth_95)
            {
                return;
            }
            text = "95峰值带宽：";
            properNum = util.unitConvert("bandwidth", trendChartData.bandwidth_95.num, trendChartData.detail_data.bandwidthUnit, timestamp);
        }

        trendChart.yAxis[0].addPlotLine({
            color: '#ed711f',
            dashStyle: 'ShortDot',
            width: 2,
            value: properNum.num,
            label: {
                text: '（' + text + properNum.num + properNum.unit + '）',
                style: {
                    color: '#ed711f'
                },
                align: 'right',
                y: -10
            },
            id: type,
            zIndex: 3
        })
    };

    var updateRateChart= function(keyType, valueType) {
        if (!rateChartData) {
            return;
        }
        var data;
        if (keyType == "domain" && valueType == "top") {
            data = rateChartData.domainMapData;
        }
        else if (keyType == "domain" && valueType == "top95") {
            data = rateChartData.domainMapData_95;
        }
        else if (keyType == "project" && valueType == "top") {
            data = rateChartData.projectMapData;
        }
        else {
            data = rateChartData.projectMapData_95;
        }
        rateChart.series[0].update({
            data : data,
            showInLegend: false,
            name : keyType
        });
    };

    var updateCompareChart = function(keyType, valueType) {
        if (!compareChartData) {
            return;
        }
        var dataThisMonth;
        var dataLastMonth;
        var arr;
        if (keyType == "domain" && valueType == "top") {
            dataThisMonth = compareChartData.domainBandwidthArrThisM || compareChartData.domainFluxArrThisM;
            dataLastMonth = compareChartData.domainBandwidthArrLastM || compareChartData.domainFluxArrLastM;
            arr = compareChartData.domainArr;
        }
        else if (keyType == "domain" && valueType == "top95") {
            dataThisMonth = compareChartData.domainBandwidthArrThisM_95 || compareChartData.domainFluxArrThisM;
            dataLastMonth = compareChartData.domainBandwidthArrLastM_95 || compareChartData.domainFluxArrLastM;
            arr = compareChartData.domainArr95 || compareChartData.domainArr;
        }
        else if (keyType == "project" && valueType == "top") {
            dataThisMonth = compareChartData.projectBandwidthArrThisM || compareChartData.projectFluxArrThisM;
            dataLastMonth = compareChartData.projectBandwidthArrLastM || compareChartData.projectFluxArrLastM;
            arr = compareChartData.projectArr;
        }
        else {
            dataThisMonth = compareChartData.projectBandwidthArrThisM_95 || compareChartData.projectFluxArrThisM;
            dataLastMonth = compareChartData.projectBandwidthArrLastM_95 || compareChartData.projectFluxArrLastM;
            arr = compareChartData.projectArr95 || compareChartData.projectArr;
        }

        compareChart.options.tooltip.formatter = function(argument) {
            if (!compareChartData)
            {
                return;
            }
            var type = $('[_dn_cdn_action="compare_btn"] checked').attr("_dn_cdn_data");
            if (compareChartData.pay_type == "flux") {
                return '<b>' + this.points[0].series.name + ": " + this.points[0].y + compareChartData[compareBtn + "Unit"] + '</b><br><b>' + this.points[1].series.name + ": " + (this.points[1].y || "--") + compareChartData[compareBtn + "Unit"] + '</b>';
            }
            else {
                return '<b>' + this.points[0].series.name + ": " + this.points[0].y + compareChartData[compareBtn + "Unit"] + '</b><br><b>' + this.points[1].series.name + ": " + (this.points[1].y || "--") + compareChartData[compareBtn + "Unit"] + '</b>';
            }
        };

        compareChart.xAxis[0].setCategories(arr);
        
        compareChart.series[0].update({
            data: dataThisMonth,
            name: dateUtil.formatDate(new Date(selectDate), "YYYY-MM")
        });
        compareChart.series[1].update({
            data: dataLastMonth,
            name: dateUtil.formatDate(new Date(selectDateLastMonth), "YYYY-MM")
        });
    };

    var updateCachePanel = function() {
        // 该月份无数据则显示"--"
        if (!cacheTableData)
        {
            $('[_dn_cdn_action="cache"]').text("--");
            $('[_dn_cdn_action="cache_basis"]').text("--");
            return;
        }
        $('[_dn_cdn_action="cache"]').text(Math.floor(cacheTableData.cache / 10) / 10 + "%");
        if (cacheTableData.cache_cmp >= 0) {
            $('[_dn_cdn_action="cache_basis"]').html('<i class="value-up"></i>' + (cacheTableData.cache_cmp / 100).toFixed(1) + '%');
        }
        else {
            $('[_dn_cdn_action="cache_basis"]').html('<i class="value-down"></i>' + (cacheTableData.cache_cmp / 100).toFixed(1) + '%');
        }
    };

    var updateTable = function(table, data) {
        table.setData({
            totalNum : data.length,
            page : 1,
            count : 10,
            list : data.slice(0, 10),
            type: "reload"
        });
    };

    var getMonthStatData = function(option) {
        var defer = $.Deferred();
        dao.get_month_stat_data({
            data: {
                month: option.month,
                view: option.view,
                count: option.count
            },
            success: {
                "0": function(rs) {
                    defer.resolve(rs);
                },
                "default": function(rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                    defer.reject(rs);
                }
            }
        });
        return defer;
    };

    return {
        container: monthlyTemplate,
        render: function(){
            initData();

            initDateSelect();

            initChart();

            initTable();
            
            initEvent();            
            
            refresh();
        }
    };

});/*  |xGv00|c2b80122da927147f48c5fdb5ecbe3b8 */