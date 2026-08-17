from pathlib import Path

p = Path("ORGA-LEGACY.html")
s = p.read_text(encoding="utf-8")

old = '''        <form id="taskForm">
          <div class="grid grid-3">
            <div class="field"><label for="title">Titre *</label><input id="title" maxlength="140" required placeholder="Ex. Relancer le syndic"></div>
            <div class="field"><label for="status">Statut</label>
              <select id="status"><option value="todo">À faire</option><option value="inprogress">En cours</option><option value="blocked">Bloqué</option><option value="done">Fait</option></select>
            </div>
            <div class="field"><label for="priority">Priorité</label>
              <select id="priority"><option value="normal">Normale</option><option value="high">Haute</option><option value="low">Basse</option></select>
            </div>
          </div>
          <div class="grid grid-2" style="margin-top:10px">
            <div class="field"><label for="dueDate">Date limite</label><input id="dueDate" type="date"></div>
            <div class="field"><label for="description">Description</label><textarea id="description" maxlength="1000" placeholder="Informations utiles, personne à contacter…"></textarea></div>
          </div>
          <button class="btn btn-primary" type="submit" style="margin-top:12px"><span id="submitLabel">Ajouter la tâche</span></button>
        </form>'''

new = '''        <form id="taskForm">
          <div class="field"><label for="title">Titre *</label><input id="title" maxlength="140" required placeholder="Ex. Relancer le syndic"></div>
          <div class="field" style="margin-top:10px"><label for="status">Statut</label>
            <select id="status"><option value="todo">À faire</option><option value="inprogress">En cours</option><option value="blocked">Bloqué</option><option value="done">Fait</option></select>
          </div>
          <div class="field" style="margin-top:10px"><label for="priority">Priorité</label>
            <select id="priority"><option value="normal">Normale</option><option value="high">Haute</option><option value="low">Basse</option></select>
          </div>
          <div class="field" style="margin-top:10px"><label for="dueDate">Date limite</label><input id="dueDate" type="date"></div>
          <div class="field" style="margin-top:10px"><label for="description">Description</label><textarea id="description" maxlength="1000" placeholder="Informations utiles, personne à contacter…"></textarea></div>
          <button class="btn btn-primary" type="submit" style="margin-top:12px"><span id="submitLabel">Ajouter la tâche</span></button>
        </form>'''

if old not in s:
    if new in s:
        raise SystemExit("Formulaire déjà modifié")
    raise SystemExit("Bloc du formulaire Nouvelle tâche introuvable")

p.write_text(s.replace(old, new, 1), encoding="utf-8")
