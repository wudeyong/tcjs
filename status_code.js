/**
* @fileOverview 状态码统计模块
* @author brandonwei
* @requires jQuery
* @update 2015-09-01
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var dialog = require('cdn/dialog');
    var statusTemplate = require("../../templates/status_code.html.js");
    var highchart = require("cdn/highcharts");
    var pager = require('cdn/lib/pager');
    var util = require('cdn/lib/util');
    var cdnUtil = require('cdn/util');
    var dateUtil = require('cdn/lib/date');
    var tips = require('cdn/tips');
    var cdnUtil = require('cdn/util');

    var _hostData;  //存储全部host信息
    var _curHostData;   //存储当前项目下的host信息
    var statusChart;
    var statusChartData;
    var statusChartPeriod;
    var distributionTable;
    var distributionTableData;
    // var unusualStatusTable;
    // var unusualStatusTableData;

    var initChart = function(){
        statusChart = getLineChart($('.tc-15-data-graph-info'));
        statusChart.hideNoData();
        statusChart.showNoData("暂无数据");
    };

    var getLineChart = function(cont,name) {
        var x,y;
        x = {
           dateTimeLabelFormats:{
                hour: '%H:%M',
                day: '%e日'
            },
            type: 'datetime'
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
                type: 'area',
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
                enabled: false
            },
            xAxis: x,
            yAxis: y,
            tooltip: {
            },
            plotOptions: {
                area: {
                    pointInterval: (5)*60*1000,//默认5分钟
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
                name: '2XX',
                data: []
            }]
        });
        
        return chart.highcharts();
    };


    var initPanel = function() {
        var str = $(".manage-area").html();
        $('.manage-area').html(str);

        var _defaultDateFormat = 'YYYY-MM-DD';

        var now = new Date().getTime();
        var today = dateUtil.formatDate(now - 0, _defaultDateFormat);
        var yesterday = dateUtil.formatDate(now - 24*3600*1000, _defaultDateFormat);
        var recent7 = dateUtil.formatDate(now - 24*3600*1000*6, _defaultDateFormat);
        var recent15 = dateUtil.formatDate(now - 24*3600*1000*14, _defaultDateFormat);
        var recent30 = dateUtil.formatDate(now - 24*3600*1000*29, _defaultDateFormat);
        var recent90 = dateUtil.formatDate(now - 24*3600*1000*89, _defaultDateFormat);
        var picker = Bee.mount('js-date-cont', {
          $data: {
            // 是否选择日历选择器
            showCalendar: true,
            // 使用的语言包，目前支持 'zh-cn' 和 'en-us'
            lang: 'zh-cn',
            // 快捷日期选项卡
            tabs: [{ label: '今天', from: today, to: today },
                { label: '昨天', from: yesterday, to: yesterday },
                { label: '近7天', from: recent7, to: today },
                { label: '近15天', from: recent15, to: today },
                { label: '近30天', from: recent30, to: today}
                ]
            }
        });

        picker.setSelectedRange(today, today);

        //只显示最近60天的数据
        picker.setAllowRange(recent90, today);

        picker.$on('datepick', function(selected) {
            var from = selected.from;
            var to = selected.to;
            $('#js-btn-search').data('from',from);
            $('#js-btn-search').data('to',to);
            var gaptime = new Date(to).getTime() - new Date(from).getTime();
            gaptime = gaptime/1000/60;//单位是分钟
            $('#js-btn-search').data('gaptime',gaptime);
            
            //更新时间段
            updatePeriodSelect(gaptime);
            
            //更新页面数据
            refresh();
        });

        //初始化的时候默认时间是今天
        $('#js-btn-search').data('from',today);
        $('#js-btn-search').data('to',today);

        //初始化的时候默认选择2XX
        $('.tc-15-rich-radio').data('checked', '2XX');

        initHost();

        initTabels();

    };

    //拉取host信息和proj信息
    var initHost = function(){
        dao.getQueryDimension({
            success : function(d){
                if(d&&d.code==0){
                    var data = d.data;
                    //缓存一下host信息
                    _hostData = data.hosts;
                    _curHostData = _hostData;
                    var hostStr = tmpl.parse($("[data-cdn-tmpl=option_cdn_hosts]").html(), {
                        data : data.hosts
                    });
                    
                    $('.js-hosts-dd-maintain').html(hostStr);
		    // 设置默认全选
                    $('.js-multi-select-panel input').prop('checked', true);
                    var str = tmpl.parse($("[data-cdn-tmpl=option_cdn_projs]").html(), {
                        data : {
                            projects:data.projects
                        }
                    });
                    $('#js-select-proj').html(str);
                }
            },
            error:function(e){
                
            }
        });
    };

    //获取当前host列表
    var getCurrHosts = function(){
        
        var inputs = $('.js-hosts-dd-wrap').find('input');
        var checkedInputs = $('.js-dl-hosts').find('input:checked');
        var res = '';
        if(checkedInputs.length==inputs.length && !($(".js-hosts-search").val().trim())){//全选且没有使用过滤功能，则传空字符串
            return res;
        }
        for(var i=0;i<checkedInputs.length;i++){
            res += $(checkedInputs[i]).val();
            if(i==checkedInputs.length-1){
                break;
            }
            res += ',';
        }
        return res;
    };

    //获取当前项目
    var getCurrProjects = function(){
        var inputs = $('#js-select-proj').find('option:selected');
        var res = '';
        res = inputs.val();
        return res;
    };

    //更新图表数据
    var updateChart = function(opt) {
        var name = opt.name;
        var resData;
        var chart = opt.chart;
        resData = opt.data[name.toLowerCase()]||[];
        chart.options.tooltip.formatter = function(argument) {
            return '<b>日期:'+Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.x)+'</b>'+
                        '<br/>'+'<b>'+this.series.name+'统计:'+(this.y)+'次</b>';
        };
            
        var period = opt.period || 5;
        var tickInterval = 3600*1000;
        if(period>=60){
            tickInterval = 24*3600*1000;
            chart.xAxis[0].options.labels.formatter = function(){
                return Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.value);
            }
        }
        
        //动态改变x轴间隔
        chart.xAxis[0].options.tickInterval = tickInterval;
        chart.series[0].update({
            data            : resData,
            name            : name,
            pointStart      : dateUtil.getUTCDateFromStr(opt.start_date),
            pointInterval   : (period)*60*1000//默认5分钟
        });

        if(resData.length==0){
            chart.hideNoData();
            chart.showNoData("暂无数据");
        }
    };

    var updatePeriodSelect = function(gaptime){//gaptime单位是分钟
        var dom = $('.js-select-period');
        var currPeriod = dom.find('option:selected').val();
        
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_period]").html(), {
            data : {gaptime:gaptime, currPeriod:currPeriod}
        });
        dom.html(str);
    };

    var initTabels = function() {
        var distributionColums = [{
                key : 'name',
                name : '返回码种类',
                order : false,
                insist : true
            }, {
                key : 'count',
                name : '数量',
                order : true,
                orderField : 'count'
            }, {
                key : 'ratio',
                name : '整体占比',
                order : true,
                orderField : 'ratio'
            }];
        // var unusualStatusColums = [{
        //         key : 'name',
        //         name : 'URL',
        //         order : false,
        //     }, {
        //         key : 'type',
        //         name : '类型',
        //         order : false
        //     }, {
        //         key : 'value',
        //         name : '次数',
        //         order : false
        //     }];
        
        distributionTable = Bee.mount('statusDistributionTable', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : distributionColums,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                // initGetData: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    "data-id" : 'id'
                }
            },
            getCellContent: function(val, item, col) {
                var res = val;
                if(col && col.key=='ratio'){
                    res= getRatio(val);
                }
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = distributionTableData;
                var order = opts.order;
                var orderField = opts.orderField;
                if(!res){
                    return;
                }
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
                var page = opts.page;
                var count = opts.count;
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
        
        // unusualStatusTable = Bee.mount('unusualStatusTable', {
        //     $data : {
        //         canSelectTotal : true,// 是否允许所有项
        //         emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
        //         // 表头/列配置
        //         colums : unusualStatusColums,
        //         hasFirst: false,
        //         maxHeightOffset : 10,// 最大高度的偏移值
        //         // initGetData: false,
        //         trAttr : {// 给每个数据行添加的额外属性.
        //             "data-id" : 'id'
        //         }
        //     },
        //     getCellContent: function(val, item, col) {
        //         var res = val;
        //         if(col && col.key=='value'){
        //             var unit = getProperUnit(val);
        //             res = unit.str;
        //         }
        //         return res
        //     },
        //     getData: function(opts) {
        //         var res = unusualStatusTableData;
        //         if(!res){
        //             return;
        //         }
        //         var page = opts.page;
        //         var count = opts.count;
        //         if(!opts.type){
        //             this.setData({
        //                 totalNum : res.length,
        //                 page : page,
        //                 count : count,
        //                 list : res.slice((page - 1) * count, res.length),                       
        //             })
        //         }
        //     }
        // }); 

        distributionTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
        // unusualStatusTable.setData({
        //     totalNum : 0,
        //     page : 1,
        //     count : 10,
        //     list :[],
        //     type:'reload'
        // });

    };

    var getRatio = function(val) {
        return Math.round(val * 10000)/100  + '%';
    };

    //取参数
    var getParam = function(){
        var param = {};
        param.stat_type = 'status_code';
        param.sources = $('.js-select-sources').val();
        param.start_date= $('#js-btn-search').data('from');
        param.end_date=$('#js-btn-search').data('to');
        param.period = $('.js-select-period').val()*1;
        param.hosts = getCurrHosts();//host格式为数组，里面可以有多个host
        param.p_id = getCurrProjects();
        
        $.each(param, function(k, v) {
            if(v === '') {
                delete param[k]
            }
        })
        
        return param;
    }

    // 下载某类型统计的数据
    var downloadStatusData = function(opt){
        opt = opt || {};
        var param = {
            view        : opt.view,
            stat_type   : 'status_code',
            sources     : $('.js-select-sources').val(),
            start_date  : $('#js-btn-search').data('from'),
            end_date    : $('#js-btn-search').data('to'),
            hosts       : getCurrHosts(),
            period      : $('.js-select-period').val()*1,
            p_id        : getCurrProjects(),
            g_tk        : cdnUtil.getACSRFToken()
        };
        $.each(param, function(k, v) {
            if(v === '') {
                delete param[k]
            }
        })

        window.location = CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=download_status_code_stat_data&'+$.param(param);

    }

    //根据选择的元素设置input的值
    var setInputVal = function(checks, key){
        var res = '';
        if (checks.length == 0) {
            $('.js-btn-ok').addClass('btn_unclick');
        }
        else {
            $('.js-btn-ok').removeClass('btn_unclick');
        }
        if(!checks || checks.val() == 'all-domain'){
            return '全部域名';
        }
        for(var i=0;i<checks.length;i++){
            res += $(checks[i]).data(key) || '';
            if(!res){
                continue;
            }
            res +=';'
        }
        return res;
    }

    //各种事件绑定
    var initEvent = function(){
        //点击域名输入框
        $('.js-input-hostname').click(function(){
            
            var self = $(this);
            var panel = $('.js-multi-select-panel');
            panel.toggle();
            
            return false;
        });


        //域名筛选搜索
        $('.js-multi-select-panel').on('input propertychange', '.js-hosts-search', function() {
            var host = $(this).val().trim();
            var hostSelect = $('.js-hosts-dd-maintain');
            var searchReg = host;


            if(host !== '') {
                if($('#domain-check-all').is(':checked')) {
                    $('#domain-check-all').click()
                }

                var res = {};
                $.each(_curHostData, function(host, hostValue) {
                    if(host.indexOf(searchReg) > -1) {
                        res[host] = {
                            name: hostValue.name,
                            p_id: hostValue.p_id
                        }
                    }
                })
                var str = tmpl.parse($("[data-cdn-tmpl=option_cdn_hosts]").html(), {
                    data : res
                });
                hostSelect.html(str)

                // 全选置灰
                $('#domain-check-all').attr('disabled', 'diaabled')
            }else{

                var str = tmpl.parse($("[data-cdn-tmpl=option_cdn_hosts]").html(), {
                    data : _hostData
                });
                hostSelect.html(str)

                // 全选取消置灰
                $('#domain-check-all').removeAttr('disabled').attr('checked', false)
            }
        })

        //选择项目的时候
        $('#js-select-proj').change(function(){
            
            var self = $(this);
            var pid = self.val();
            var hostSelect = $('.js-hosts-dd-maintain');
            var res = {};
            
            $('.js-input-hostname').val('全部域名');
            
            for(var i in _hostData){
                var tmp = _hostData[i];
                //全部项目就把host都填好
                if(pid==''){
                    res = _hostData;
                    break;
                }
                if(tmp['p_id']==pid){
                    res[i] = tmp;
                }
            }
            _curHostData = res;

            var str = tmpl.parse($("[data-cdn-tmpl=option_cdn_hosts]").html(), {
                data : res
            });
            hostSelect.html(str)
            // 设置默认全选
            $('.js-multi-select-panel input').prop('checked', true);
            
            return false;
            
        });

        //多选面板处理
        $('.js-multi-select-panel').on('click',function(e){
            
            var self = $(this);
            var target = $(e.target);
            if((target.hasClass('js-btn-ok') || target.parent().hasClass('js-btn-ok')) && !target.hasClass('btn_unclick') && !target.parent().hasClass('btn_unclick')){
                
                var checks = self.find('input:checked');
                var res  = setInputVal(checks, 'name');
                $('.js-input-hostname').val(res);
                self.hide();
                return false;
            }else if(target.is('input')){
                var res = '';
                var checks = self.find('input');
                // 点击全部域名
                if (target.val() == 'all-domain')
                {
                    var isChecked = target.prop('checked');
                    checks.prop('checked', isChecked);
                }
                // 点击其他单个域名
                else {
                    var inputLength = $('.js-hosts-dd-wrap input').length;
                    var checkedInputLength = $('.js-hosts-dd-wrap input:checked').length;
                    if (checkedInputLength == inputLength && !($(".js-hosts-search").val().trim())) {
                        checks.prop('checked', true);
                    }
                    else {
                        $(checks[0]).prop('checked', false);
                    }
                }
                checks = self.find('input:checked');
                res = setInputVal(checks, 'name');
                $('.js-input-hostname').val(res);
                e.stopPropagation();
                
            }else if(target.is('label')){
                var input = target.prev();
                    input.trigger('click');
                return false;
            }else if(target.hasClass('js-btn-cancel') || target.parent().hasClass('js-btn-cancel')){
                self.hide();
                return false;
            }
            
        });

        //多选对话框关闭
        $('.js-status-main-wrap').on('click',function(e){
            // 如果没勾选，则不隐藏panel
            /*if($('.js-btn-ok').hasClass('btn_unclick')) {
                return
            }*/
            
            $('.js-multi-select-panel').hide();            
        });

        //点击查询
        $('#js-btn-search').click(function() {
            refresh();            
            return false;
        });

        // 2XX,3XX,4XX,5XX图表选择按钮
        $('.tc-15-rich-radio').on('click', function(e) {
            var self = $(this);
            var target = $(e.target);
            if (!target.is('button'))
            {
                return;
            }
            var oldText = $('.tc-15-rich-radio').data("checked");
            var newText = target.text();
            var buttons = $('.tc-15-rich-radio button');
            var start_date = $('#js-btn-search').data('from');
            if (oldText == "2XX") {
                buttons.eq(0).removeClass("checked");
                target.addClass("checked");
            } else if (oldText == "3XX") {
                buttons.eq(1).removeClass("checked");
            } else if (oldText == "4XX") {
                buttons.eq(2).removeClass("checked");               
            } else if (oldText == "5XX") {
                buttons.eq(3).removeClass("checked");
            }
            target.addClass("checked");
            $('.tc-15-rich-radio').data("checked", newText);
            updateChart({
                name:newText,
                period:statusChartPeriod,
                start_date:dateUtil.formatDate(start_date, "YYYY-MM-DD 00:00:00"),
                chart:statusChart,
                data:statusChartData
            });

        });

        //点击下载
        $('#statusDownLoad').click(function(){
            downloadStatusData({view: 'time'})
            
        });
        $('#distributionDownLoad').click(function(){
            downloadStatusData({view: 'code'})
        });
        // $('#unusualStatusDownLoad').click(function(){
            
        //     var self = $(this);
        //     var param = getParam('flux');
        //     param.g_tk = dayuUtil.getACSRFToken();
        //     param.top_type = "url";
        //     self.attr('href','//dy.qcloud.com/ajax/api.php?action=download_stat_top_data&'+$.param(param));
            
        // });

    };

    var refresh = function() {
        var param = getParam();
        var name = $('.tc-15-rich-radio').data('checked');
        getStatusData(param).done(function(d) {
            if(d&&d.code==0){
                var data = d.data;
                var count = 10;
                var page = 1;
                statusChartData = data.time_data || {};
                statusChartPeriod = data.period;
                distributionTableData = data.code_data || [];
                updateChart({
                    name:name,
                    period:statusChartPeriod,
                    start_date:dateUtil.formatDate(param.start_date, "YYYY-MM-DD 00:00:00"),
                    chart:statusChart,
                    data:statusChartData
                });

                var orderField = distributionTable.$data.orderField;
                var order = distributionTable.$data.order;
                if (orderField)
                {
                    if (order == 1) {
                        distributionTableData.sort(function(item1, item2) {
                            return parseFloat(item1[orderField]) - parseFloat(item2[orderField]);
                        });
                    }
                    else {
                        distributionTableData.sort(function(item1, item2) {
                            return parseFloat(item2[orderField]) - parseFloat(item1[orderField]);
                        });
                    }
                }
                distributionTable.setData({
                    totalNum : distributionTableData.length,
                    page : 1,
                    count : 10,
                    list : distributionTableData.slice((page - 1) * count, count),
                    type:"reload"
                });
                
            }
            else {
                tips.error(d.msg || '获取地域信息数据失败');
            }
        });
    };

    var getStatusData = function(param) {
        var defer = $.Deferred();
        dao.get_status_code_stat_data({
            data:param,
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                tips.error('获取地域信息数据失败');
                defer.reject(e);
            }
        });
        return defer.promise();
    }

    return{
        container: statusTemplate,
        render: function(){
            initPanel();
            
            initEvent();
            
            initChart();
            
            refresh();
        }
    };
});/*  |xGv00|75a1ed51aef53f344aba7b7cbcfc27e8 */