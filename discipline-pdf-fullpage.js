(function(){
  "use strict";

  function install(){
    var root=window.jspdf;
    if(!root||!root.jsPDF||!root.jsPDF.API||typeof root.jsPDF.API.addImage!=="function")return false;
    var api=root.jsPDF.API;
    if(api.__inovtecFullPagePhotos)return true;

    var originalAddImage=api.addImage;
    api.addImage=function(imageData,format,x,y,width,height,alias,compression,rotation){
      var isDisciplinePhoto=(typeof x==="number"&&typeof y==="number"&&typeof width==="number"&&typeof height==="number"&&width>0&&height>0);
      if(!isDisciplinePhoto)return originalAddImage.apply(this,arguments);

      try{
        var landscape=width>height;
        var currentPage=typeof this.getNumberOfPages==="function"?this.getNumberOfPages():1;

        // Le générateur Discipline peut créer une page vide juste avant une photo.
        // On la retire pour éviter toute feuille blanche à l'impression.
        if(Number(y)<=20&&currentPage>1&&typeof this.deletePage==="function"){
          try{this.deletePage(currentPage);}catch(ignore){}
        }

        this.addPage("a4",landscape?"landscape":"portrait");

        var pageW=this.internal.pageSize.getWidth();
        var pageH=this.internal.pageSize.getHeight();
        var margin=5;
        var maxW=pageW-(margin*2);
        var maxH=pageH-(margin*2);
        var ratio=Math.min(maxW/width,maxH/height);
        var printW=width*ratio;
        var printH=height*ratio;
        var printX=(pageW-printW)/2;
        var printY=(pageH-printH)/2;

        return originalAddImage.call(this,imageData,format,printX,printY,printW,printH,alias,compression||"FAST",rotation);
      }catch(error){
        console.warn("Mise en page photo PDF",error);
        return originalAddImage.apply(this,arguments);
      }
    };

    api.__inovtecFullPagePhotos=true;
    return true;
  }

  if(!install()){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(install()||tries>40)clearInterval(timer);
    },100);
  }
})();