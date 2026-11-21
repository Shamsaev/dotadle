import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy Policy — Dotadle" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      en={<>
        <p>This policy explains what data Dotadle (the website and the Discord Activity) collects and how it is used. Dotadle has no ads, does not sell data and does not share it with advertisers.</p>
        <h2>What we collect</h2>
        <ul>
          <li><b>Account data</b> from Discord or Google when you sign in: user ID, display name and avatar URL. We do not store your email address or password.</li>
          <li><b>Discord servers</b> (scope <code>guilds</code>): IDs, names, icons and your permissions in the servers you are a member of. They are used only to create server leagues and to recognise league admins. Only leagues that already exist in Dotadle (or the server where you launch the Activity) are saved.</li>
          <li><b>Game data</b>: your guesses, results, points, streaks, race results, statistics, nickname, chosen avatar, colour and theme.</li>
          <li><b>League data</b>: league names, tournaments, sponsor info added by admins and Discord webhook URLs connected by admins.</li>
          <li><b>Technical data</b>: a session cookie to keep you signed in, and small preferences in your browser’s local storage. Our hosting provider may keep standard server logs (such as IP address and request time) for security.</li>
        </ul>
        <h2>How we use it</h2>
        <p>Only to run the game: to save progress, show leaderboards and leagues, run races, and, if a league admin connected a webhook, post results of league members to that Discord channel. Your display name, avatar, points and streak are visible to other players in leaderboards, races and league channels.</p>
        <h2>Where it is stored</h2>
        <p>The Service is hosted on Vercel, and data is stored in an Upstash Redis database. These providers process data on our behalf.</p>
        <h2>How long we keep it</h2>
        <p>Daily guesses and results are kept for about 45 days, race rooms for 12 hours. Profile, points and statistics are kept while the Service is running or until you ask us to delete them.</p>
        <h2>Your rights</h2>
        <p>You can ask us to export or delete your data at any time: <Contact lang="en" />. You can also revoke Dotadle’s access in Discord (User Settings → Authorized Apps) or in your Google account.</p>
        <h2>Children</h2>
        <p>Dotadle is not intended for children under 13 and does not knowingly collect their data.</p>
        <h2>Changes</h2>
        <p>We may update this policy; the date above shows the latest version.</p>
      </>}
      ru={<>
        <p>Здесь описано, какие данные собирает Dotadle (сайт и Discord Activity) и зачем. В Dotadle нет рекламы, мы не продаём данные и не передаём их рекламодателям.</p>
        <h2>Что мы собираем</h2>
        <ul>
          <li><b>Данные аккаунта</b> из Discord или Google при входе: ID пользователя, отображаемое имя и ссылку на аватар. Почту и пароль мы не храним.</li>
          <li><b>Серверы Discord</b> (доступ <code>guilds</code>): ID, названия, иконки серверов, где вы состоите, и ваши права на них. Нужны только для лиг серверов и для того, чтобы узнать их админов. Сохраняются лишь лиги, которые уже есть в Dotadle, или сервер, на котором вы запустили Activity.</li>
          <li><b>Игровые данные</b>: ваши попытки, результаты, очки, серии, итоги гонок, статистика, ник, выбранные аватар, цвет и тема.</li>
          <li><b>Данные лиг</b>: названия лиг, турниры, информация о спонсорах от админов и ссылки вебхуков Discord, которые подключили админы.</li>
          <li><b>Технические данные</b>: cookie сессии, чтобы вы оставались в аккаунте, и небольшие настройки в local storage браузера. Хостинг может вести стандартные журналы сервера (IP-адрес, время запроса) для безопасности.</li>
        </ul>
        <h2>Зачем</h2>
        <p>Только для работы игры: сохранять прогресс, показывать рейтинги и лиги, проводить гонки, а если админ лиги подключил вебхук, публиковать результаты игроков лиги в этот Discord-канал. Ваши имя, аватар, очки и серия видны другим игрокам в рейтингах, гонках и каналах лиг.</p>
        <h2>Где хранятся данные</h2>
        <p>Сервис размещён на Vercel, данные хранятся в базе Upstash Redis. Эти компании обрабатывают данные по нашему поручению.</p>
        <h2>Сколько храним</h2>
        <p>Ежедневные попытки и результаты хранятся около 45 дней, комнаты гонок 12 часов. Профиль, очки и статистика хранятся, пока работает Сервис, или до вашего запроса на удаление.</p>
        <h2>Ваши права</h2>
        <p>Вы можете в любой момент попросить выгрузить или удалить ваши данные: <Contact lang="ru" />. Можно также отозвать доступ Dotadle в Discord (Настройки → Авторизованные приложения) или в аккаунте Google.</p>
        <h2>Дети</h2>
        <p>Dotadle не предназначен для детей младше 13 лет и сознательно не собирает их данные.</p>
        <h2>Изменения</h2>
        <p>Политика может обновляться, дата выше показывает актуальную версию.</p>
      </>}
    />
  );
}
