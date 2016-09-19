define(function(require, exports, module) {
    var highcharts = require('cdn/highcharts');
    var dialog = require('cdn/dialog');
    var tips = require('cdn/tips');
    var router = require("cdn/router");
    var _ = require('cdn/lib/underscore');
    var tmpl = require("cdn/lib/tmpl");
    var util = require('cdn/lib/util');
    var dateUtil = require('cdn/lib/date');
    var dao = require("cdn/data/dao");
    var helper = require("cdn/data/helper");
    var widgets = require("cdn/widgets/widgets");
    var htmlTemplate = require("../../templates/overview.html.js");
    require("cdn/components/overviewLinearChart");

    var Container = '.cdn-gailan';
    var Component = {
        main: '',
        section: '',
        chart: ''
    };

    function dao_Promise(daoName, param) {
        var defer = $.Deferred();
        var param = param || {};

        param = _.each(param, function(val, key) {
            val === '' && delete param[key]
        })

        dao[daoName]({
            success : {
                "0" : function(rs) {
                    defer.resolve(rs);
                },
                "default":function(rs){
                    defer.reject(rs);
                }
            },
            data: param
        });
        return defer.promise();
    }

    function initSection() {
        $('#section_placeholder').html($('#today_section').html())

        Component.section = Bee.mount($('#section_placeholder').get(0), {
            $data: {
                real_data: {
                    flux: 0,
                    flux_unit: '',
                    bandwidth: 0,
                    bandwidth_unit: '',
                    requests: 0,
                    requests_unit: '',
                    cache: 0,
                    ip_visits: 0,
                    ip_visits_unit: '',
                },
                cmp_data: {
                    flux: 0,
                    bandwidth: 0,
                    requests: 0,
                    cache: 0,
                    ip_visits: 0
                },
                pay_type: '',
                datetime: ''
            },

            $afterInit: function() {
                var self = this;

                $(Container).on('proj_change', function() {
                    self.getGlobalStatData.call(self, {
                        project_id: Component.main.projectIdCurrent
                    })
                })
            },

            // 获取今日数据
            getGlobalStatData: function(param) {

                var self = this;

                dao_Promise('getGlobalStatData', param).then(function(rs) {

                    var data = rs.data;
                    
                    //处理下数据格式
                    data = self.fixGlobalData(data);

                    _.each(data, function(val, key) {
                        self.$set(key, val)
                    })

                }).fail(function(e) {
                    tips.error(e.errmsg || e.msg || helper._defaultErrMsg);
                });
            },

            fixGlobalData: function(data){
                data = _.extend({}, data)

                var real_data = data.real_data;
                var cmp_data = data.cmp_data;
                
                var flux = widgets.changeUnit('flux', real_data.flux)
                real_data.flux = flux.num;
                real_data.flux_unit = flux.unit;

                var bandwidth = widgets.changeUnit('bandwidth', real_data.bandwidth)
                real_data.bandwidth = bandwidth.num;
                real_data.bandwidth_unit = bandwidth.unit;

                if(real_data.requests > 100000) {
                    if (document.cookie.indexOf("language=en") > -1) {
                        real_data.requests = real_data.requests/1000;
                        real_data.requests_unit = 'K';
                    }
                    else {
                        real_data.requests = real_data.requests/10000;
                        real_data.requests_unit = '万';
                    }
                    real_data.requests = util.formatNumber(real_data.requests, 2, ',');
                }else{
                    real_data.requests_unit = '';
                    real_data.requests = util.formatNumber(real_data.requests, 0, ',');
                }

                if(real_data.ip_visits > 100000) {
                    if (document.cookie.indexOf("language=en") > -1) {
                        real_data.ip_visits = real_data.ip_visits/1000;
                        real_data.ip_visits_unit = 'K';
                    }
                    else {
                        real_data.ip_visits = real_data.ip_visits/10000;
                        real_data.ip_visits_unit = '万';
                    }

                    real_data.ip_visits = util.formatNumber(real_data.ip_visits, 2, ',');

                }else{
                    real_data.ip_visits_unit = '';
                    real_data.ip_visits = util.formatNumber(real_data.ip_visits, 0, ',');
                }

                real_data.cache = util.formatNumber(real_data.cache, 2, '');



                _.each(cmp_data, function(val, key) {
                    if(val == null) {
                        cmp_data[key] = '-'
                    }else {
                        cmp_data[key] = util.formatNumber(val, 2, ',');
                    }
                })

                return data
            },

            resumeNumber: function(str) {
                if(typeof(str) === 'string') {
                    str = str.replace(/,/g, '')
                }
                return str
            },

            toBandwidth: function() {
                router.navigate('/cdn/statistics/usage?stat_type=bandwidth')
            },

            toFlux: function() {
                router.navigate('/cdn/statistics/usage')
            },

            toRequest: function() {
                router.navigate('/cdn/statistics/visit')
            },

            toVisit: function() {
                router.navigate('/cdn/statistics/visit?stat_type=ip_visits')
            },

            toCache: function() {
                router.navigate('/cdn/statistics/visit?stat_type=cache')
            },
        });
    }

    function initChildren() {
        initSection()
    }

    function initMain() {
        Component.main = Bee.mount($('.cdn-gailan').get(0) , {
            $data: {
                isDataReady: false,
                projectList: [],                        // project列表
                projSelected: '',                       // 当前的project object
                projectIdCurrent: '',                   // 当前的projectId

                bulletin: '',
                permission: false,
                total_host: 0,
                user_status: '',
                pay_type: '',
                pay_type_str: '',
                next_pay_type: '',
                next_pay_type_str: '',
                flux_data: {
                    flux_data_num: 0,
                    flux_data_unit: '',
                },
                bandwidth_data: {
                    bandwidth_data_num: 0,
                    bandwidth_data_unit: 0
                },
                flux_package: {
                    enable_num: 0,
                    sum_flux_bytes: 0,
                    sum_used_bytes: 0
                },
                month_rate: {
                    flux_data: 0,
                    bandwidth_data: 0
                },
                billing_type: '',
                billing_type_str: '',
                total_data: [],
                running_host: 0,

                graph: {
                    title: 'CDN本月趋势',
                    start_date: '',
                    end_date: '',
                    period: 24*60,
                    unit: '',
                    pay_type: '',
                    data_name: '',
                    points: [],
                    showUnit: true,
                    formatterTimeUnit: "MM-DD"
                }

            },

            $afterInit: function() {
                var self = this;

                $(Container).on('proj_change', function() {
                    self.getGeneralData.call(self, {
                        project_id: self.projectIdCurrent
                    })
                })

                this.$watch('user_status', function(val) {
                    /**
                    user_status:  trail 试用态用户；quota_suspended 试用已停用的用户； normytal 资质审核通过的正常用户； overdue_suspended 欠费停用的用户
                            sum_flux_bytes： 已激活使用的流量包的总大小（单位byte）
                            code： 错误码 9169 代表用户流量爆表已经被停用了。（所有写接口都会有这个判断逻辑，相同的错误码）
                     */
                    if(val == "overdue_suspended"){

                        dialog.create($('#overdue_suspended_dialog').html(), '480', '', {
                                'title': '停服提醒', //标题
                                'closeIcon': true, //是否配置删除图标
                                'mask': true, //蒙层
                                'defaultCancelBtn': false, //自动补全取消按钮
                                'isMaskClickHide': false, //点击蒙层关闭
                                'buttonHighlight': [1,0],
                                'button': {
                                    '缴费': function() {
                                        window.open('https://console.qcloud.com/account/recharge')
                                    },
                                    '返回': function() {
                                        dialog.hide()
                                    }
                                }
                            }) ;
                    }else if(val == "quota_suspended"){

                        dialog.create($('#quota_suspended_dialog').html(), '480', '', {
                                'title': '停服提醒', //标题
                                'closeIcon': true, //是否配置删除图标
                                'mask': true, //蒙层
                                'defaultCancelBtn': false, //自动补全取消按钮
                                'isMaskClickHide': false, //点击蒙层关闭
                                'buttonHighlight': [1,0,0],
                                'button': {
                                    '认证': function() {
                                        window.open('https://console.qcloud.com/developer/infomation')
                                    },
                                    '购买流量包': function() {
                                        window.open('https://manage.qcloud.com/shoppingcart/shop.php?tab=cdn')
                                    },
                                    '返回': function() {
                                        dialog.hide()
                                    }
                                }
                            }) ;
                    }
                })
            },

            projSelectAction: function(selected) {
                Component.main.$set('projSelected', selected);
                Component.main.$set('projectIdCurrent', selected.value);

                $(Container).trigger('proj_change')
            },

            // 获取项目列表
            getProjectList: function() {
                dao_Promise('getProjectList').then(function(rs) {

                    var projs = rs.data.projects;
                    var projectList = []

                    projectList.push({ 
                        "label": '全部项目',
                        "value": ''
                    })

                    _.each(projs, function(proj) {
                        projectList.push({ 
                            "label": proj.name,
                            "value": proj.id
                        })
                    })

                    Component.main.$set('projectList', projectList);
                    Component.main.$set('projSelected', projectList[0]);

                    $(Container).trigger('proj_change')

                }).fail(function(e) {
                    tips.error(e.errmsg || e.msg || helper._defaultErrMsg);
                });
            },

            // 获取公告
            getBulletin: function(param) {

                dao_Promise('getBulletinData', param).then(function(rs) {

                    Component.main.$set('bulletin', rs.data.bulletin);

                }).fail(function(e) {
                    tips.error(e.errmsg || e.msg || helper._defaultErrMsg);
                });
            },

            // 获取常规数据
            getGeneralData: function(param) {

                var self = this;

                dao_Promise('getGeneralData', param).then(function(rs) {

                    var data = rs.data;
                    
                    data = self.fixGeneralData(data)

                    _.each(data, function(val, key) {
                        if(key !== 'graph') {
                            self.$set(key, val)
                        }else {
                            self.$replace(key, val)
                        }
                    })

                    self.$set('isDataReady', true)

                    // self.$set('graph.points', [1123])

                }).fail(function(e) {
                    tips.error(e.errmsg || e.msg || helper._defaultErrMsg);
                });
            },

            fixGeneralData: function(data){
                data = _.extend({}, data)

                if (data.permission === "MANAGE_HUMAN_RESOURCE" || data.permission === "MANAGE_CLOUD_RESOURCE") {
                    data.permission = true;
                } else if (data.permission === "PRJ_MANAGE_CLOUD_RESOURCE") {
                    data.permission = false;
                }

                data.pay_type_str = helper.pay_type[data.pay_type];
                data.next_pay_type_str = helper.pay_type[data.next_pay_type];
                data.bandwidth_data = {
                    bandwidth_data_num: widgets.changeUnit(data.pay_type, data.bandwidth_data.china).num,
                    bandwidth_data_unit: widgets.changeUnit(data.pay_type, data.bandwidth_data.china).unit
                };
                data.flux_data = {
                    flux_data_num: widgets.changeUnit(data.pay_type, data.flux_data.china).num,
                    flux_data_unit: widgets.changeUnit(data.pay_type, data.flux_data.china).unit
                };
                data.billing_type_str = helper.billing_type[data.billing_type];

                if(data.month_rate.flux_data == null){
                    data.month_rate.flux_data = '-';
                }else{
                    data.month_rate.flux_data = data.month_rate.flux_data.toFixed(2)
                }

                if(data.month_rate.bandwidth_data == null){
                    data.month_rate.bandwidth_data = '-';
                }else{
                    data.month_rate.bandwidth_data = data.month_rate.bandwidth_data.toFixed(2)
                }

                data.flux_package.sum_flux_str = widgets.changeUnit('flux', data.flux_package.sum_flux_bytes).str;
                data.flux_package.sum_used_str = widgets.changeUnit('flux', data.flux_package.sum_used_bytes).str;

                if(data.pay_type === 'bandwidth') {
                    data.graph = {
                        unit: 'b',
                        points: data.total_data.bandwidth_data
                    }
                }else if(data.pay_type === 'flux') {
                    data.graph = {
                        unit: 'Byte',
                        points: data.total_data.flux_data
                    }
                }
                _.extend(data.graph, {
                    title: 'CDN本月趋势',
                    start_date: util.format(new Date(), '%Y-%m') + '-01',
                    end_date: util.format(new Date(), '%Y-%m') + '-' + dateUtil.getMonthDays(),
                    period: 24*60,
                    data_name: util.format(new Date(), '%Y-%m'),
                    pay_type: data.pay_type
                })

                return data
            },

            modifyPayType: function(permission) {

                if(!permission) {
                    tips.error('对不起，您无权变更计费方式') 
                    return
                }

                var hasData = $('.chart-area').highcharts().hasData();
                var billing_type = Component.main.billing_type;
                var pay_type = Component.main.pay_type;

                var pop = dialog.create(tmpl.parse($('#modify_dialog').html(), {
                    billing_type: billing_type,
                    hasData: hasData
                }), '480', '', {
                    title : '变更计费方式',
                    preventResubmit : true,
                    "class" : "dialog_layer_v2",
                    button : {
                        '确定变更' : function() {
                            var val = pop.find("[name=paytype]:checked").data("val");
                            if (val == pay_type) {
                                dialog.hide();
                                return;
                            }

                            //modify_pay_type 接口，添加一个可选参数：current，取值为0/1
                            //current为1：如果hasData为false，后台只修改pay_type
                            //current为0：如果hasData为true，后台只更新next_pay_type.
                            
                            //用户在选择变更计费方式的时候，从流量计费切换到带宽计费，点击“确定变更”。判断用户从下个月开始未来12个月是否有使用的流量包，如果有则弹出提示。
                            if(Component.main.flux_package && Component.main.flux_package.enable_num > 0 && val=="bandwidth"){
                                dialog.create($('#confirm_dialog').html(), '480', '', {
                                    title : '变更计费方式确认',
                                    preventResubmit : true,
                                    "class" : "dialog_layer_v2",
                                    button : {
                                        '确定变更' : function() {
                                            Component.main.setPaytype({
                                                pay_type: val,
                                                current: hasData ? 0:1
                                            })
                                        }
                                    }
                                });
                                return false;       
                            }

                            Component.main.setPaytype({
                                pay_type: val,
                                current: hasData ? 0:1
                            })

                        }
                    }
                });
                if (pay_type == "bandwidth") {
                    pop.find("[name=paytype][data-val=bandwidth]").prop("checked", true);
                } else {
                    pop.find("[name=paytype][data-val=flux]").prop("checked", true);
                }
            },

            cancelModify: function(permission) {
                if(!permission) {
                    tips.error('对不起，您无权变更计费方式') 
                    return
                }

                Component.main.setPaytype({
                    pay_type: Component.main.pay_type
                })
            },

            setPaytype: function(params) {
                dao_Promise('setPaytype', params).then(function(rs) {

                    tips.success('修改计费方式成功')

                    dialog.hide();
                    // if(!hasData){
                    $(Container).trigger('proj_change')
                    // }

                }).fail(function(e) {
                    tips.error(e.errmsg || e.msg || helper._defaultErrMsg);
                });
            },

            payCalculator: function() {

                var pop = dialog.create($('#caculator_dialog').html(), 600, null, 
                        {
                            title : '费用计算器',
                            preventResubmit : true,
                            defaultCancelBtn : false,
                            buttonHighlight: [0],
                            'class' : "dialog_layer_v2 select-project",
                            button : {
                                '关闭' : function() {
                                    
                                    dialog.hide();
                                    
                                    return;
                                }
                            }
                        });
                //计算        
                pop.find('.js-caculate').off('click').on('click',function(){
                    
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

                    var type = $('.b_selected').data('type');
                    res = widgets.calculate(type, val);
                    if(type === 'flux'){
                        pop.find('.js-total-cost').text(res+'元');
                    }else if(type === 'bandwidth'){
                        pop.find('.js-total-cost').text(res+'元/日');
                    }
                    
                    return false;
                });
                pop.find('.js-cacl-item-tab').off('click').on('click',function(){
                    var self = $(this);
                    self.addClass('b_selected').siblings().removeClass('b_selected');
                    if(self.data('type') === 'flux'){
                        pop.find('.js-cacl-type-flux').show();
                        pop.find('.js-cacl-type-bandwidth').hide();
                    }else if(self.data('type') === 'bandwidth'){
                        pop.find('.js-cacl-type-bandwidth').show();
                        pop.find('.js-cacl-type-flux').hide();
                    }
                    pop.find('input').val('');
                    pop.find('.js-total-cost').text('0元');
                    return false;
                });
                
                return false;
            },

            accessArea: function() {
                router.navigate("/cdn/access");
            },

            fluxArea: function() {
                router.navigate("/cdn/statistics/usage");
            },

            packageArea: function() {
                router.navigate("/cdn/tools/package");
            },

            showAllDetail: function() {
                router.navigate("/cdn/statistics/usage?stat_type=" + Component.main.pay_type);
            }

        })
    }

    function init() {
        initChildren()
        
        initMain()

        Component.main.getProjectList()

        Component.main.getBulletin()
    }

    return {
        container : htmlTemplate,
        render : init
    }
});/*  |xGv00|52211169d02dbd291beaa96b1a6a7dd4 */