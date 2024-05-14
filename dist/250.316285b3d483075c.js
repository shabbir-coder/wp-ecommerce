"use strict";(self.webpackChunkcoreui_free_angular_admin_template=self.webpackChunkcoreui_free_angular_admin_template||[]).push([[250],{2250:(F,u,n)=>{n.r(u),n.d(u,{ChatSettingsModule:()=>A});var l=n(6814),m=n(8642),o=n(95),t=n(5678),d=n(6860),h=n(886),a=n(1806);function p(e,c){if(1&e&&(t.TgZ(0,"option",23),t._uU(1),t.qZA()),2&e){const i=c.$implicit;t.Q6J("value",i),t.xp6(1),t.Oqu(i)}}function f(e,c){if(1&e&&(t.TgZ(0,"option",23),t._uU(1),t.qZA()),2&e){const i=c.$implicit;t.Q6J("value",i),t.xp6(1),t.Oqu(i)}}const g=[{path:"",component:(()=>{class e{constructor(i,r,s){this.fb=i,this.apiService=r,this.toastr=s,this.title="Chat Configuration",this.modes=[{id:"cod",name:"Cash On Delivery"},{id:"upi",name:"UPI"},{id:"qr",name:"QR Code"},{id:"number",name:"Number"}]}ngOnInit(){this.hours=Array.from({length:24},(i,r)=>r),this.minutes=Array.from({length:60},(i,r)=>r),this.chatForm=this.fb.group({paymentLink:["",o.kI.required],sessionDuration:this.fb.group({hours:["",o.kI.required],minutes:["",o.kI.required]}),CartKeyword:["",o.kI.required],paymentKeyword:["",o.kI.required]}),this.getConfigData()}onSubmit(){this.chatForm.valid?this.apiService.createOrUpdateChatForm(this.chatForm.value).subscribe(i=>{this.toastr.showSuccess("Chat Configuration updated")},i=>{console.error("Error saving/updating chat form:",i),this.toastr.showError("Error updating")}):this.toastr.showError("Invalid form data. Please check the form fields.")}getConfigData(){this.apiService.getChatConfig().subscribe(i=>{this.chatForm.patchValue(i.data)})}get sessionDuration(){return this.chatForm.get("sessionDuration")}static#t=this.\u0275fac=function(r){return new(r||e)(t.Y36(o.qu),t.Y36(d.s),t.Y36(h.h))};static#e=this.\u0275cmp=t.Xpm({type:e,selectors:[["app-chatsetting"]],decls:40,vars:4,consts:[[1,"fade-in"],[1,"container","mt-2"],[1,"d-flex","justify-content-between"],[1,"divider","my-2"],[1,"row"],["cForm","",1,"col-md-6","col-12",3,"formGroup"],[1,"mb-3"],["cLabel","","for","session"],[1,"d-flex"],["formGroupName","sessionDuration"],["formControlName","hours",1,"form-select"],["value","","selected","","hidden","","disabled",""],[3,"value",4,"ngFor","ngForOf"],[1,"mx-2"],["formControlName","minutes",1,"form-select"],["cLabel","","for","paylink"],["cFormControl","","id","paylink","placeholder","www.payment.qr.exmaple","type","text","formControlName","paymentLink"],["cLabel","","for","cart"],["cFormControl","","id","cart","placeholder","Cart","type","text","formControlName","CartKeyword"],["cLabel","","for","pay"],["cFormControl","","id","pay","placeholder","payment","type","text","formControlName","paymentKeyword"],[1,"col-md-6","col-12"],["cButton","","color","primary","variant","outline",3,"click"],[3,"value"]],template:function(r,s){1&r&&(t.TgZ(0,"div",0)(1,"c-card")(2,"c-card-body")(3,"div",1)(4,"div",2)(5,"h4"),t._uU(6),t.qZA()()(),t._UZ(7,"div",3),t.TgZ(8,"div",4)(9,"form",5)(10,"div",6)(11,"label",7),t._uU(12,"Session Duration"),t.qZA(),t.TgZ(13,"div",8),t.ynx(14,9),t.TgZ(15,"select",10)(16,"option",11),t._uU(17,"HH"),t.qZA(),t.YNc(18,p,2,2,"option",12),t.qZA(),t.TgZ(19,"span",13),t._uU(20,":"),t.qZA(),t.TgZ(21,"select",14)(22,"option",11),t._uU(23,"MM"),t.qZA(),t.YNc(24,f,2,2,"option",12),t.qZA(),t.BQk(),t.qZA()(),t.TgZ(25,"div",6)(26,"label",15),t._uU(27,"Payment Link"),t.qZA(),t._UZ(28,"input",16),t.qZA(),t.TgZ(29,"div",6)(30,"label",17),t._uU(31,"Keyword for Cart access"),t.qZA(),t._UZ(32,"input",18),t.qZA(),t.TgZ(33,"div",6)(34,"label",19),t._uU(35,"Keyword for Payment access"),t.qZA(),t._UZ(36,"input",20),t.qZA()(),t._UZ(37,"div",21),t.qZA(),t.TgZ(38,"button",22),t.NdJ("click",function(){return s.onSubmit()}),t._uU(39,"Save"),t.qZA()()()()),2&r&&(t.xp6(6),t.Oqu(s.title),t.xp6(3),t.Q6J("formGroup",s.chatForm),t.xp6(9),t.Q6J("ngForOf",s.hours),t.xp6(6),t.Q6J("ngForOf",s.minutes))},dependencies:[l.sg,a.$_X,a.oHf,a.eFW,a.AkF,a.yue,a.Hq3,o._Y,o.YN,o.Kr,o.Fj,o.EJ,o.JJ,o.JL,o.sg,o.u,o.x0]})}return e})()}];let v=(()=>{class e{static#t=this.\u0275fac=function(r){return new(r||e)};static#e=this.\u0275mod=t.oAB({type:e});static#o=this.\u0275inj=t.cJS({imports:[m.Bz.forChild(g),m.Bz]})}return e})();var C=n(1272),y=n(9862),Z=n(332);let A=(()=>{class e{static#t=this.\u0275fac=function(r){return new(r||e)};static#e=this.\u0275mod=t.oAB({type:e});static#o=this.\u0275inj=t.cJS({imports:[l.ez,v,a.ejP,a.dTQ,a.zE6,C.QX,a.hJ1,a.gzQ,a.z8t,o.u5,y.JF,o.UX,Z.A0]})}return e})()}}]);