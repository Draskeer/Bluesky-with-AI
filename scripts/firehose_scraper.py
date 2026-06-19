import psycopg2
import time
import threading
import queue
from atproto import FirehoseSubscribeReposClient, parse_subscribe_repos_message, models, CAR

# ==========================================
# 1. CONFIGURATION
# ==========================================
DB_HOST = "localhost"
DB_PORT = "5433"          
DB_NAME = "bluesky_data"
DB_USER = "bluesky"
DB_PASSWORD = "bluesky_secret"

# On crée un "panier" (Queue) pour stocker temporairement les posts avant insertion
post_queue = queue.Queue()

# Variable pour arrêter proprement les processus
is_running = True

stats = {
    "ajoutes": 0,
    "ignores_doublons": 0,
    "ignores_langue": 0,
    "start_time": time.time()
}

# ==========================================
# 2. LE TRAVAILLEUR (Base de Données)
# ==========================================
def db_worker():
    """Ce thread tourne en arrière-plan et vide le panier dans la BDD par lots (Batch)"""
    global stats, is_running
    
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Le travailleur n'a pas pu se connecter à la BDD : {e}")
        return

    insert_query = """
        INSERT INTO raw_post_pointers (created_at, message_id)
        VALUES (%s, %s)
        ON CONFLICT (message_id, created_at) DO NOTHING;
    """

    while is_running or not post_queue.empty():
        try:
            # On attend qu'un post arrive dans le panier (timeout de 1 sec pour pouvoir s'arrêter proprement)
            item = post_queue.get(timeout=1.0)
        except queue.Empty:
            continue

        batch = [item]
        
        # On vide tout ce qui s'est accumulé dans le panier (jusqu'à 100 posts d'un coup)
        while len(batch) < 100 and not post_queue.empty():
            try:
                batch.append(post_queue.get_nowait())
            except queue.Empty:
                break

        # On insère le paquet complet dans PostgreSQL
        try:
            for timestamp, message_id in batch:
                cursor.execute(insert_query, (timestamp, message_id))
                if cursor.rowcount == 1:
                    stats["ajoutes"] += 1
                else:
                    stats["ignores_doublons"] += 1
            conn.commit() # On sauvegarde le lot
        except Exception as e:
            print(f"❌ Erreur d'insertion du lot : {e}")
            conn.rollback()
            
        # Affichage des stats (Toutes les ~100 insertions)
        total = stats["ajoutes"] + stats["ignores_doublons"] + stats["ignores_langue"]
        if total % 100 == 0 or total % 100 < len(batch):
            elapsed = time.time() - stats["start_time"]
            print(f"⏱️ [{(elapsed/60):.1f} min] | 📥 Gardés: {stats['ajoutes']} | ⏭️ Ignorés(Langue): {stats['ignores_langue']} | 🔄 Doublons: {stats['ignores_doublons']} | 🛒 En attente: {post_queue.qsize()}")

    cursor.close()
    conn.close()

# ==========================================
# 3. L'ÉCOUTEUR (Firehose)
# ==========================================
def process_message(message):
    """Ce thread ne fait QUE lire le réseau et remplir le panier le plus vite possible"""
    global stats
    
    commit = parse_subscribe_repos_message(message)
    if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit) or not commit.blocks:
        return

    try:
        car = CAR.from_bytes(commit.blocks)
    except Exception:
        return

    for op in commit.ops:
        if op.action == 'create' and 'app.bsky.feed.post' in op.path:
            record_raw = car.blocks.get(op.cid)
            if not record_raw:
                continue
                
            langs = record_raw.get('langs', [])
            if 'en' not in langs and 'fr' not in langs:
                stats["ignores_langue"] += 1
                continue
                
            message_id = f"at://{commit.repo}/{op.path}"
            timestamp = record_raw.get('createdAt')
            
            # Au lieu d'insérer en base, on le jette dans le panier ! (C'est instantané)
            post_queue.put((timestamp, message_id))

# ==========================================
# 4. LANCEMENT DU SYSTÈME
# ==========================================
if __name__ == '__main__':
    print("🚒 Démarrage du Firehose Anti-Crash...")
    
    # 1. On lance le Cerveau 2 (Travailleur BDD) en arrière-plan
    worker_thread = threading.Thread(target=db_worker)
    worker_thread.start()
    
    # 2. On lance le Cerveau 1 (Firehose) dans le processus principal
    client = FirehoseSubscribeReposClient()
    
    try:
        client.start(process_message)
    except KeyboardInterrupt:
        print("\n🛑 Arrêt demandé par l'utilisateur...")
    finally:
        print("⏳ Attente que le travailleur vide le panier dans la BDD...")
        is_running = False
        worker_thread.join() # On attend que la BDD ait fini d'enregistrer les derniers posts
        print("✅ Base de données fermée proprement. À bientôt !")