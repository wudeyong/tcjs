/**
 * @fileOverview 使用量统计
 * @author galenye
 * @requires jQuery
 * @update 2015-03-09
 */
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var dialog = require('cdn/dialog');
    var usageTemplate = require("../../templates/visit.html.js");
    var highchart = require("cdn/highcharts");
    var pager = require('cdn/lib/pager');
    var util = require('cdn/lib/util');
    var dateUtil = require('cdn/lib/date');
    var tips = require('cdn/tips');
    var cdnUtil = require('cdn/util');

    var _titleMap = {
        'requests'  : '请求数',
        'ip_visits' : 'IP访问次数',
        'cache'     : '命中率'
    };
    var _hostTypeStr = {
        'cname' : '自有源',  
        'ftp'   : 'FTP托管源',
        'svn'   : 'SVN',
        'cos'   : 'COS源'
    }
    var _defaultDateFormat = 'YYYY-MM-DD';
    var PAGE_SIZE = 5;
    var _defaultErrMsg = '服务器繁忙，请稍后再试';

    var _areaChart;             //访问情况统计详情图
    var _provinceColumnChart;   //请求数运营商对比图
    var _ispColumnChart;        //省份TOP10图
    var _detailTable;           //初始化访问状况统计图
    var _top100Table;           //域名访问状况Top100图

    var _hostData;              //存储全部host信息
    var _curHostData;           //存储当前项目下的host信息
    var _detailTableData;       //存储 初始化访问状况统计 数据
    var _top100TableData;       //存储 域名访问状况Top100 数据
    var _data = {};


    /* 初始化头部面板 start */
    var initPanel = function() {

        initDateSelector();

        getQueryDimension().then(function(q) {
            var qData = q.data;

            //保存一下hostdata备用
            _hostData = qData.hosts;
            _curHostData = _hostData;

            initProjects(qData.projects);
            initHosts(qData.hosts);
            initLocations(qData.locations);
            initIsps(qData.isps);
        })
    }

    var initDateSelector = function() {
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
            tabs: [{ label: '今天', from: today, to: today},
                { label: '昨天', from: yesterday, to: yesterday },
                { label: '近7天', from: recent7, to: today },
                { label: '近15天', from: recent15, to: today },
                { label: '近30天', from: recent30, to: today}
                ]
            }
        });
        //只显示最近90天的数据
        picker.setAllowRange(recent90, today);
        picker.setSelectedRange(today, today);
        picker.$on('datepick', function(selected) {
            var from = selected.from;
            var to = selected.to;
            $('#js-btn-search').data('from',from);
            $('#js-btn-search').data('to',to);
            var gaptime = new Date(to).getTime() - new Date(from).getTime();
            gaptime = gaptime/1000/60;//单位是分钟
            $('#js-btn-search').data('gaptime',gaptime);
            updatePeriodSelect(gaptime);

            $('#js-btn-search').click();
        });
    }

    var initProjects = function(projects) {
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_projects]").html(), {
            data : projects
        });
        $('.js-select-projs').append(str);
    }

    var initHosts = function(hosts) {
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_hosts]").html(), {
            data : hosts
        });
        $('.js-hosts-dd-maintain').html(str);
    }

    var initLocations = function(locations) {
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_locations]").html(), {
            data : locations
        });
        $('.js-dl-provinces').append(str);
    }

    var initIsps = function(isps) {
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_isps]").html(), {
            data : isps
        });
        $('.js-select-isps').append(str);
    }
    /* 初始化头部面板 end */

    /* 初始化主体图表 start */
    var initTables = function() {

        // 初始化访问情况统计详情
        _areaChart = initAreaChart();
        
        //初始化运营商图表
        _ispColumnChart = initColumnChart({
            container: $('.js-chart-isp')
        });

        //初始化省份TOP10
        _provinceColumnChart = initColumnChart({
            container: $('.js-chart-province')
        });

        // 初始化访问状况Top100
        initUsageTable()

        // 初始化访问状况统计
        initTop100Table()
    }

    // 初始化流量使用详情图
    var initAreaChart = function(data) {
        var cont = $('.js-chart-area');
        var type = 'requests';
        var x,y;
        if(type=='requests'){
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
                labels: {
                    formatter: function() {
                        return this.value;
                    }
                }
            };
        }else if(type=='ip_visits'){
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
                labels: {
                    formatter: function() {
                        return this.value;
                    }
                }
            };
        }else if (type == 'cache') {
            x = {
                dateTimeLabelFormats : {
                    hour : '%H:%M',
                    day : '%e日'
                },
                type : 'datetime'
            };
            y = {
                title : {
                    text : ''
                },
                labels : {
                    formatter : function() {
                        return this.value;
                    }
                },
                max: 100
            };
        }
        
        var areaChart = $(cont).highcharts({
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
            xAxis: x,
            yAxis: y,
            tooltip: {
                //pointFormat: '{series.name} produced <b>{point.y:,.0f}</b><br/>warheads in {point.x}'
                //enabled:false
            },
            plotOptions: {
                area: {
                    // pointStart : dateUtil.getUTCDateFromStr(data.start_datetime),
                    // pointInterval : (data.period || 5) * 60 * 1000,//默认5分钟
                    marker: {
                        enabled: false,
                        symbol: 'circle',
                        radius: 2,
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
                data: [
                ]
            }]
        });
        
        return areaChart.highcharts();
    }
    
    // 初始化柱状图
    var initColumnChart = function(opt){
        var container = opt.container;
        var chart = container.highcharts({
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
    
            }]
        });
        return chart.highcharts();
    }

    //初始化域名流量/带宽使用详情
    var initUsageTable = function(){

        var detailColums = [{
                key : 'host_name',
                name : '域名',
                order : false,
                insist : true
            }, {
                key : 'host_type',
                name : '类别'
            }, {
                key : 'requests',
                name : '请求数'
            }, {
                key : 'ip_visits',
                name : 'ip访问数'
            }, {
                key : 'cache',
                name : '命中率'
            }];

        _detailTable = Bee.mount('js-detail-table-wrap', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : detailColums,
                maxHeightOffset : 10,// 最大高度的偏移值
                hasFirst: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    "data-id" : 'id'
                }
            },
            getCellContent : function(res, item, col) {
                if (col && col.key == 'requests'
                        || col.key == 'ip_visits') {
                    res = res + "次"
                } else if (col && col.key == 'cache') {
                    res = ((res - 0)).toFixed(2) - 0;
                    if (res != 0) {
                        res = res + "%"
                    }
                } else if (col && col.key == "host_type") {
                    res = item.host_type_str
                }
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = _detailTableData;
                if(!res){
                    return;
                }
                var page = opts.page;
                var count = opts.count;
                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, page * count)                      
                    })
                }
                
            }
        }); 

        _detailTable.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
    }
    
    //初始化流量/带宽使用top100表格
    var initTop100Table = function(){

        var useColums = [{
            key : 'name',
            name : 'URL',
            order : false,
            insist : true
        }, {
            key : 'requests',
            name : '请求数'
        }];

        _top100Table = Bee.mount('js-top100-table-wrap', {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                emptyTips : '抱歉，没有找到相关数据。', // 列表为空时的提示,
                // 表头/列配置
                colums : useColums,
                hasFirst: false,
                maxHeightOffset : 10,// 最大高度的偏移值
                // initGetData: false,
                trAttr : {// 给每个数据行添加的额外属性.
                    
                }
            },
            getCellContent : function(val, item, col) {
                var res = val;
                 if (col && col.key == 'requests') {
                        res = res + "次"
                } 
                return '<span class="text-overflow">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = _top100TableData;
                if(!res){
                    return;
                }
                var page = opts.page;
                var count = opts.count;
                if(!opts.type){
                    this.setData({
                        totalNum : res.length,
                        page : page,
                        count : count,
                        list : res.slice((page - 1) * count, page * count)                      
                    })
                }
            }
        });

        _top100Table.setData({
            totalNum : 0,
            page : 1,
            count : 10,
            list :[],
            type:'reload'
        });
    }
    /* 初始化主体图表 end */


    /* 获取当前参数 start */
    var getCurrParams = function(opt){
        opt = opt || {};
        var _default = {
            // view     : opt.view,
            sources     : getSources(),
            start_date  : getCurrDate('start'),
            end_date    : getCurrDate('end'),
            hosts       : getCurrHosts(),
            isps        : getCurrIsps(),
            provinces   : getCurrProvinces(),
            period      : getCurrPeriod(),
            p_id        : getCurrProjects(),
            g_tk        : cdnUtil.getACSRFToken()
        };
        var params = $.extend(_default, opt)

        params = filterParam(params)

        return params
    }

    var getCurrHosts = function(){
        var inputs = $('.js-hosts-dd-wrap').find('input');
        var checkedInputs = $('.js-dl-hosts').find('input:checked');
        var allChecked = $('#domain-check-all').is(':checked');
        var res = '';
        if(allChecked && !$('.js-hosts-search').val()){//全选传空字符串
            return res;
        }

        //没有选中等于全选

        for(var i=0;i<checkedInputs.length;i++){
            res += $(checkedInputs[i]).val();
            if(i==checkedInputs.length-1){
                break;
            }
            res += ',';
        }
        return res;
    }
    
    var getCurrIsps = function(){
        var inputs = $('.js-select-isps').find('option:selected');
        var res = '';
        res = inputs.val();
        if (undefined == res || null == res) {
            return "";
        }
        return res;
    }
    
    var getCurrProvinces = function(){
        var inputs = $('.js-dl-provinces').find('input:checked');
        var res = '';

        if($('.js-province-all').is(':checked')) {
            return res
        }

        if(inputs.length==0){//没有选中等于全选
        }
        for(var i=0;i<inputs.length;i++){
            res += $(inputs[i]).val();
            if(i==inputs.length-1){
                break;
            }
            res += ',';
        }
        return res;
    }
    
    var getCurrProjects = function(){
        var inputs = $('.js-select-projs').find('option:selected');
        var res = '';
        res = inputs.val();
        if (undefined == res || null == res) {
            return "";
        }
        return res;
    }

    var getSources = function(){
        var inputs = $('.js-select-sources').find('option:selected');
        var res = '';
        res = inputs.val() || 'oc';
        return res;
    }
    
    var getCurrDate = function(type){
        var res;
        var startDate,endDate;
        
        startDate = $('#js-btn-search').data('from');
        endDate = $('#js-btn-search').data('to');
        
        if(type=='start'){
            res = startDate;
        }else if(type=='end'){
            res = endDate;
        }
        
        res = res || dateUtil.formatDate(new Date(),_defaultDateFormat);
        
        return res;
    }
    
    var getCurrPeriod = function(){
        var input = $('.js-select-period').find('option:selected');
        var res = '';
        if(input.length==0){
            input = $('.js-select-period').find('option:first');
        }
        res = input.attr('value');
        if (undefined == res || null == res) {
            return "";
        }
        return res;
    }

    var getCurrStatType = function() {
        return $('.js-top-chart .checked').data('type')
    }
    /* 获取当前参数 end */


    // 事件绑定
    var initEvent = function(){
        //tab点击事件
        $('.js-top-chart .tc-15-btn').click(function(){
            
            var self = $(this);
            self.addClass('checked');
            self.siblings().removeClass('checked');

            renderTime(_data);
            renderOther(_data);
            
            return false;
        });
        
        //选择项目之后域名跟他联动
        $('.js-select-projs').change(function(){
            var self = $(this);
            var option = self.find('option:selected');
            var pid = option.val();
            var hostSelect = $('.js-hosts-dd-maintain');
            var res = {};
            // 项目变更之后，默认选中该项目的全部域名
            $('.js-input-hostname').val('全部域名');

            for(var i in _hostData){
                var hid = i;
                //全部项目就把host都填好
                if(pid==''){
                    res[hid] = {
                        name : _hostData[i]['name'],
                        p_id : _hostData[i]['p_id']
                    }
                    continue;
                }
                if(_hostData[i]['p_id']==pid){
                    res[hid] = {
                        name : _hostData[i]['name'],
                        p_id : pid
                    }
                }
            }
            _curHostData = res;
            var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_hosts]").html(), {
                data : res
            });
            hostSelect.html(str)

            // 项目变更之后，默认选中该项目的全部域名
            $('#domain-check-all').prop('checked', true);
            $('.js-hosts-search').val('')
            return false;
        });
        
        // 域名搜索框
        $('.js-multi-select-panel').on('input propertychange', '.js-hosts-search', function() {
            var host = $(this).val();
            var hostSelect = $('.js-hosts-dd-maintain');
            var searchReg = host;


            if(host !== '') {

                var res = {};
                $.each(_curHostData, function(host, hostValue) {
                    if(host.indexOf(searchReg) > -1) {
                        res[host] = {
                            name: hostValue.name,
                            p_id: hostValue.p_id
                        }
                    }
                })
                var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_hosts]").html(), {
                    data : res
                });
                hostSelect.html(str)

                if($('#domain-check-all').is(':checked')) {
                    $('#domain-check-all').prop('checked', false)
                }
                hostSelect.find('input').prop('checked', false)

                //选中就设置值
                var checks = hostSelect.find('input:checked');
                var res = setInputVal(checks, 'name');
                $('.js-input-hostname').val(res);

            }else{

                var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_hosts]").html(), {
                    data : _curHostData
                });
                hostSelect.html(str)

                if(!$('#domain-check-all').is(':checked')) {
                    $('#domain-check-all').prop('checked', true)
                }

                $('.js-input-hostname').val('全部域名');
            }
        })

        //点击搜索
        $('#js-btn-search').click(function(){

            // 搜索单个运营商时，ip访问数跟命中率都没有数据，这两列不显示
            setDetailColums()

            getVisitStatData_curry('time')(function(resData) {
                _data.start_datetime = resData.start_datetime;
                _data.end_datetime = resData.end_datetime;
                _data.period = resData.period;
                _data.time_data = resData.time_data;
                renderTime(_data);
            })
            getVisitStatData_curry('host')(function(resData) {
                _data.host_data = resData.host_data;
                _detailTableData = resData.host_data;
                renderHost(_data);
            })
            getVisitStatData_curry('prov')(function(resData) {
                _data.prov_data = resData.prov_data;
                renderProv(_data);
            })
            getVisitStatData_curry('isp')(function(resData) {
                _data.isp_data = resData.isp_data;
                renderIsp(_data);
            })
            getVisitStatData_curry('url')(function(resData) {
                _data.url_data = resData.url_data;
                _top100TableData = resData.url_data; 
                renderUrl(_data);
            })

            renderOther();

            return false;
        });
        
        //多选框的toggle
        $('.js-multi-select').click(function(){
            
            var self = $(this);
            
            var panel = self.siblings('.js-multi-select-panel');
            
            panel.toggle();
            panel.css({
                left:self.position().left
            })
            return false;
        });
        
        //多选框的按钮disable判断
        $('.js-multi-select-panel').on('click',function(e){
            var self = $(this);
            var target = $(e.target);
            var panel = target.parents('.js-multi-select-panel');

            /*
                当点击全选，则全选全部，运营商恢复成“全部运营商”，
                如果是域名面板，则input变成“全部域名”字样
                如果是地域面板，则input变成“全部地区”字样
                当取消全选，域名input致空
             */
            if(target.is('input')){
                if(target.hasClass('js-checkbox-all')){
                    var val = target.prop('checked');
                    self.find('input').prop('checked',val);
                    
                    //互斥关系
                    if(val){
                        self.find('.dialog_layer_ft .js-btn-ok').removeClass('btn_unclick');
                        if (target.attr('id') == 'domain-check-all') {
                            if(!$('.js-hosts-search').val()) {
                                panel.siblings('.js-multi-select').val('全部域名');
                            }else{
                                //选中就设置值
                                var checks = panel.find('input:checked');
                                var res = setInputVal(checks, 'name');

                                panel.siblings('.js-multi-select').val(res);
                            }
                        }else {
                            panel.siblings('.js-multi-select').val('全部地区');
                        }
                        $('.js-select-isps').val('');
                    }else{
                        self.find('.dialog_layer_ft .js-btn-ok').addClass('btn_unclick');
                        panel.siblings('.js-multi-select').val('');
                    }
                    
                }else{
                    if(self.find('.js-hosts-dd-wrap').length) {
                        var c = self.find('.js-hosts-dd-wrap input');
                    }else{
                        var c = self.find('.mini_cont input');
                    }
                    var all = true;
                    var canClick = false;
                    var res = '';
                    $.each(c, function(i, v) {
                        if(!$(v).prop('checked')){
                            all = false;        //如果有不是钩的则退出
                            return false
                        }else{
                            all = true;         //全部钩
                        }

                    });

                    if(!all) {
                        $.each(c, function(i, v) {
                            if($(v).prop('checked')){
                                canClick = true;    //如果有一个钩则退出，表示可点击
                                return false
                            }
                        });
                    }else{
                        canClick = true;
                    }

                    self.find('.js-checkbox-all').prop('checked',all);
                    if(all) {
                        if(self.find('.js-checkbox-all').attr('id') == 'domain-check-all') {
                            if(!$('.js-hosts-search').val()) {
                                res = '全部域名';
                            }else{
                                //选中就设置值
                                var checks = panel.find('input:checked');
                                res = setInputVal(checks, 'name');
                            }
                        }else {
                            res = '全部地区';
                        }
                        
                    }else{
                        //选中就设置值
                        var checks = panel.find('input:checked');
                        res = setInputVal(checks, 'name');
                    }

                    if(canClick) {
                        self.find('.dialog_layer_ft .js-btn-ok').removeClass('btn_unclick');
                    }else{
                        self.find('.dialog_layer_ft .js-btn-ok').addClass('btn_unclick');
                    }

                    //互斥关系
                    if(res){
                        $('.js-select-isps').val('');
                        // $('.js-select-sources').val('oc');
                    }
                    panel.siblings('.js-multi-select').val(res);
                    
                }
                
                
                //这个事件不要冒泡了，不然点击input把自己也关闭了
                e.stopPropagation();
            }else if(target.is('label')){
                var input = target.prev();
                input.trigger('click');
                return false;
            //点击确定按钮    
            }else if(target.hasClass('js-btn-ok') || target.parent().hasClass('js-btn-ok')){
                if(target.hasClass('btn_unclick') || target.parent().hasClass('btn_unclick')) {
                    return false
                }
                self.hide();
                return false;
            //点击取消按钮    
            }else if(target.hasClass('js-btn-cancel') || target.parent().hasClass('js-btn-cancel')){
                self.hide();
                return false;
                
            }else{
                return false;
            }
        });
        //互斥关系
        $('.js-select-isps').change(function(){
            if(!$('#province-check-all').is(':checked')) {
                $('#province-check-all').click();
            }
            // $('.js-select-sources').val('oc');
        });

        //多选对话框关闭
        $('.js-usage-main-wrap').on('click',function(e){

            $('.js-multi-select-panel').hide();
            
        });

        //下载趋势详情
        $('.js-usage-main-wrap').on('click','.js-download-trenddata', function(e){
            downloadVistStatData({view: 'time'})
        });
        
        $('.js-usage-main-wrap').on('click','.js-download-topdata', function(e){
            var self = $(this);
            var top_type = self.data('download-type');

            downloadVistStatData({view: top_type})
        });
        
        $('.js-usage-main-wrap').on('click','.js-download-hostsdata', function(e){
            downloadVistStatData({view: 'host'})
        });
    }


    /* 渲染图表 start */
    // 图和表填充数据
    var renderOther = function(d) {
        var stat_type = getCurrStatType();

        //只有请求数量需要展示运营商和省份数据
        if(stat_type=='requests'){
            $('.js-chart-detail-wrap').show();
        }else{
            $('.js-chart-detail-wrap').hide();
        }
    }

    var renderTime = function(d) {
        var stat_type = getCurrStatType();

        //更新区域图
        updateAreaChart(d, stat_type);
    };

    var renderProv = function(d) {
        var stat_type = getCurrStatType();

        //省份信息保留10个
        var provinceData ;//= data.prov_data;
        
        if(d.prov_data.length>=10){
            provinceData = d.prov_data.slice(0,10); 
        }else{
            provinceData = d.prov_data;
        }
        updateColumnChart({
            type        : 'province',
            stat_type   : stat_type,
            data        : provinceData,
            name        : '省份数据'
        });
    }

    var renderIsp = function(d) {
        var stat_type = getCurrStatType();

        updateColumnChart({
            type        : 'isp',
            stat_type   : stat_type,
            data        : d.isp_data,
            name        : '运营商数据'
        });
    }

    var renderHost = function(d) {
        var stat_type = getCurrStatType();

        updateDetailTable(d.host_data, stat_type);
    }

    var renderUrl = function(d) {
        var stat_type = getCurrStatType();

        updateTop100Table(d.url_data, stat_type);
    }
    
    //更新使用详情图
    var updateAreaChart = function(opt, stat_type){
        var type = stat_type;
        var name = _titleMap[type];
        var resData = opt.time_data[type];

        if(type=='requests' || type=='ip_visits'){

            _areaChart.options.tooltip.formatter = function(argument) {
                return '<b>日期:'
                        + Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.x)
                        + '</b>' + '<br/>' + '<b>' + name + ':' + this.y + "次"
                        + '</b>';
            };
            $('.js-areachart-unit').text('（' + name + '：' + "次" + '）');

            // 改变Y轴最大值为100
            _areaChart.yAxis[0].options.max = null;

        } else {
            _areaChart.options.tooltip.formatter = function() {
                var res = this.y;
                if (res != 0) {
                    res = res.toFixed(2) + "%"
                }
                return '<b>日期:'
                        + Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.x)
                        + '</b>' + '<br/>' + '<b>' + name + ':' + res + '</b>';
            };
            $('.js-areachart-unit').text('（' + name + '：%' +'）');

            // 改变Y轴最大值为100
            _areaChart.yAxis[0].options.max = 100;

        }
        
        var period = opt.period || 5;
        var tickInterval = 3600*1000;
        if(period>=60){
            tickInterval = 24*3600*1000;
            _areaChart.xAxis[0].options.labels.formatter = function(){
                return Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.value);
            }
        }
        
        //动态改变x轴间隔
        _areaChart.xAxis[0].options.tickInterval = tickInterval;
        
        _areaChart.series[0].update({
            data            : resData,
            name            : name,
            pointStart      : dateUtil.getUTCDateFromStr(opt.start_datetime),
            pointInterval   : (period)*60*1000//默认5分钟
        });
        
        if(resData.length==0){
            _areaChart.hideNoData();
            _areaChart.showNoData("暂无数据");
        }
    }
    
    //更新柱状图
    var updateColumnChart = function(opt){
        var name = opt.name;
        var chart;
        var type = opt.type;
        var stat_type = opt.stat_type;
        var data = opt.data;
        var xData = [];
        var yData = [];
        if(type=='isp'){
            chart = _ispColumnChart;
            for(var i=0;i<data.length;i++){
                xData.push(data[i].name);
                yData.push(data[i].requests*1);
            }
        }else if(type=='province'){
            chart = _provinceColumnChart;
            for(var i=0;i<data.length;i++){
                xData.push(data[i].name);
                yData.push(data[i].requests*1);
            }
        }
        
        
        if(stat_type == 'requests' || stat_type == 'ip_visits'){
            chart.options.tooltip.formatter = function(argument) {
                var y = this.y;
                return '<b>' + y + ':次</b>';
            };
        }else if (stat_type == 'cache') {
            chart.options.tooltip.formatter = function(argument) {
                var y = this.y;
                return '<b>' + y + '%</b>';
            };
        }
        
        chart.xAxis[0].setCategories(xData);
        
        chart.series[0].update({
            data: yData,
            name: name
        });
        if(data.length==0){
            chart.hideNoData();
            chart.showNoData("暂无数据");
        }
    }

    //更新域名详情表格
    var updateDetailTable = function(data, type){
        
        var count = 10;
        var page = 1;

        if(!data){
            data=[];
        }

        fixDetailData(data, type);

        _detailTable.setData({
            totalNum : data.length,
            page : 1,
            count : 10,
            list : data.slice((page - 1) * count, count),
            type:"reload"
        });
    }

    //更新域名top 100表格
    var updateTop100Table = function(data, type){

        var count = 10;
        var page = 1;

        if(!data){
            data=[];
        }

        fixTop100Data(data, type);

        _top100Table.setData({
            totalNum : data.length,
            page : 1,
            count : 10,
            list : data.slice((page - 1) * count, count),
            type:"reload"
        });
    }
    /* 渲染图表 end */

    /* 接口调用 start */
    //获取统计页面顶部的数据
    var getQueryDimension = function(opt){
        var param = {};

        var defer = $.Deferred();

        dao.getQueryDimension({
            data    : param,
            success : function(d){
                defer.resolve(d);
            },
            error   : function(d){
                d = d || {};
                tips.error(d.errmsg || d.msg || _defaultErrMsg);
                defer.reject(d);
            }
        });

        return defer.promise();
    }

    // 获取某类型统计的数据
    var getVisitStatData = function(opt){
        var param = getCurrParams(opt);

        var defer = $.Deferred();
        dao.getVisitStatData({
            data    : param,
            success : function(d) {
                defer.resolve(d);
            },
            error   : function(d){
                d = d || {};
                tips.error(d.errmsg || d.msg || _defaultErrMsg);
                defer.reject(d)
            }
        })

        return defer.promise();
    }

    // 下载某类型统计的数据
    var downloadVistStatData = function(opt){

        var url = CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=download_visit_stat_data';
        var param = getCurrParams(opt);

        var temp_form = document.createElement("form");
        temp_form.action = url;
        temp_form.target = "_blank";
        temp_form.method = "post";
        temp_form.style.display = "none";
        for (var x in param) {      
            var opt = document.createElement("textarea");      
            opt.name = x;      
            opt.value = param[x];      
            temp_form .appendChild(opt);      
        }
        document.body.appendChild(temp_form);
        temp_form.submit();
    }
    /* 接口调用 end */
    



    /* 辅助函数 start */
    var fixDetailData = function(data, type){
        if(!data){
            return;
        }

        for(var i=0;i<data.length;i++){
            var hostType = data[i].host_type;

            data[i].host_type_str = _hostTypeStr[hostType];
        }
    }
    
    //处理下数据单位
    var fixTop100Data = function(data, type){
        if(!data){
            return;
        }
        //如果超过100则截取前100
        if(data.length>100){
            data = data.slice(0,100); 
        }
    }
    
    // 获取某类型统计的数据，柯里化
    var getVisitStatData_curry = function(view) {

        return function(fn) {
            getVisitStatData({view: view}).then(function(res) {
                if(res.code==0) {
                    resData = res.data;

                    fn(resData)
                }else{
                    // url中存在hosts参数且后台返回9105则去掉参数
                    if (res.code == 9105 && paramHost)
                    {
                        router.navigate("/cdn/statistics/visit");
                    }
                    else {
                        tips.error(res.msg || _defaultErrMsg);
                    }
                }
            })
        }
    }

    // 过滤参数
    var filterParam = function(param) {
        $.each(param, function(k, v) {
            if(v === '') {
                delete param[k]
            }
        })

        return param
    }
    
    var updatePeriodSelect = function(gaptime){//gaptime单位是分钟
        var dom = $('.js-select-period');
        var currPeriod = dom.find('option:selected').val();
        
        var str = tmpl.parse($("[data-cdn-tmpl=select_cdn_period]").html(), {
            data : {gaptime:gaptime, currPeriod:currPeriod}
        });
        dom.html(str);
    }
    
    //根据选择的元素设置input的值
    var setInputVal = function(checks, key){
        var res = '';
        if(!checks || checks.length==0){
            return;
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

    // 搜索单个运营商时，ip访问数跟命中率都没有数据，这两列不显示
    var setDetailColums = function() {
        var columsWithoutIpCache = [{
            key : 'host_name',
            name : '域名',
            order : false,
            insist : true
        }, {
            key : 'host_type',
            name : '类别'
        }, {
            key : 'requests',
            name : '请求数'
        }];

        var colums = [{
            key : 'host_name',
            name : '域名',
            order : false,
            insist : true
        }, {
            key : 'host_type',
            name : '类别'
        }, {
            key : 'requests',
            name : '请求数'
        }, {
            key : 'ip_visits',
            name : 'ip访问数'
        }, {
            key : 'cache',
            name : '命中率'
        }];

        if (getCurrIsps() || getCurrProvinces()) {
            _detailTable.setColums(columsWithoutIpCache);
            $('.js-top-chart .tc-15-btn').addClass('disabled').removeClass('checked');
            $('.js-top-chart .tc-15-btn[data-type="requests"]').removeClass('disabled').addClass('checked');
            $('.js-top-chart .tc-15-btn').off('click');
        }else {
            _detailTable.setColums(colums);
            //tab点击事件
            $('.js-top-chart .tc-15-btn').off('click').click(function(){
                
                var self = $(this);
                self.addClass('checked');
                self.siblings().removeClass('checked');

                renderTime(_data);
                renderOther(_data);
                
                return false;
            });
            $('.js-top-chart .tc-15-btn').removeClass('disabled');
        }
    }

    var emit = function() {
        var type = util.getParameter('stat_type') || 'requests';            
        var paramHost = util.getParameter('hosts');

        //处理下tab选中态
        $('.js-top-chart .tc-15-btn').removeClass('checked');
        $('.js-top-chart button[data-type='+type+']').addClass('checked');

        if(paramHost) {
            $('.js-multi-select-panel .mini_cont .js-dl-hosts').parents('.js-multi-select-panel').find('input').prop('checked', false);
            $('.js-multi-select-panel .mini_cont .js-dl-hosts input[data-name="'+ paramHost + "\"]").trigger('click');
        }

        $('#js-btn-search').click();
    }
    /* 辅助函数 end */

    return {
        container : usageTemplate,
        render : function() {

            initPanel();

            initTables();

            initEvent();

            emit();

            
        }
    }
});/*  |xGv00|19c435f9068e0c1dca7dbd0c767d4a21 */