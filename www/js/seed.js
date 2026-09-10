function seedDemo(){
  const t = todayISO(), y = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const in3 = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  S = { version:1, tours:["Cabinet Durand","Cabinet Les Oliviers"], curTour:"all",
    patients:[
      { id:"p1", nom:"Demo-Martin", prenom:"Yvonne", dob:"1941-03-12", ctx:"Diabète type 2 insulino-requérant. Chat à l'entrée !", tours:["Cabinet Durand"],
        plan:["Insuline (Lantus 18 UI)","Glycémie capillaire","Préparation pilulier"], docs:[],
        bilans:[{ id:uid(), type:"Consultation", date:in3, statut:"À faire", res:"Cardiologue Dr Lopez 14h30" }],
        visits:[
          { uid:uid(), date:y, at:"07:45", soins:["Insuline (Lantus 18 UI)","Glycémie capillaire"], consts:{ta:"14/8",glyc:"1.15",puls:"76"}, note:"" },
          { uid:uid(), date:t, at:"07:50", soins:["Insuline (Lantus 18 UI)"], consts:{glyc:"0.65"}, note:"Vertiges au lever, resucrage fait, fille prévenue." }
        ]},
      { id:"p2", nom:"Demo-Roux", prenom:"Henri", dob:"1936-11-02", ctx:"Ulcère jambe droite, pansement 1 j/2. Aidant : épouse.", tours:["Cabinet Durand"],
        plan:["Pansement complexe (ulcère JD)","Surveillance prise Trt"], docs:[],
        bilans:[{ id:uid(), type:"Prise de sang", date:in3, statut:"À faire", res:"NFS + CRP prescrite par Dr Blanc, labo à domicile" }],
        visits:[
          { uid:uid(), date:y, at:"08:20", soins:["Pansement complexe (ulcère JD)"], consts:{ta:"13/7",temp:"36.9",sat:"96",douleur:"3"}, note:"Détersion faite, bourgeonnement propre." }
        ]},
      { id:"p3", nom:"Demo-Sauveur", prenom:"Lucie", dob:"1958-06-27", ctx:"Anticoagulant post-phlébite, fin de Trt le 12/09.", tours:["Cabinet Les Oliviers"],
        plan:["Injection anticoagulant","Bas de contention"], docs:[], visits:[] }
    ],
    rappels:[
      { id:uid(), pid:"p2", type:"pharmacie", due:t,  text:"Récupérer sets de pansement + Bétadine", done:false },
      { id:uid(), pid:"p1", type:"rdv", due:in3, text:"RDV cardiologue Dr Lopez 14h30 — prévoir transport", done:false },
      { id:uid(), pid:"p3", type:"absence", due:in3, text:"Absente 3 jours (chez sa sœur) — pas de passage", done:false }
    ]};
  save();
}
/* helpers définis plus haut (getP, activeP, inTour, rapOf, bilansPending, migrate) */

/* ---------- Statut / rendu pancarte ---------- */
