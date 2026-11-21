import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms of Service — Dotadle" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      en={<>
        <p>These Terms govern your use of Dotadle (the website and the Discord Activity, together the “Service”). By using the Service you agree to these Terms.</p>
        <h2>1. The Service</h2>
        <p>Dotadle is a free fan-made guessing game about Dota 2 heroes. It includes daily puzzles, races with friends, leaderboards and leagues. Dotadle is not affiliated with, endorsed or sponsored by Valve Corporation. Dota 2, hero names and images are trademarks and property of Valve Corporation.</p>
        <h2>2. Accounts</h2>
        <p>You sign in with Discord or Google. You must meet the minimum age required by Discord and Google in your country (at least 13). You are responsible for activity under your account.</p>
        <h2>3. Acceptable use</h2>
        <p>Do not cheat, automate guesses, exploit bugs, attack or overload the Service, impersonate others, or use offensive nicknames. League and tournament admins are responsible for the content they add (league names, tournament names, sponsor links). We may remove content, reset scores or block access if these rules are broken.</p>
        <h2>4. Supporter perks and promo codes</h2>
        <p>Supporting the project is voluntary. Supporter and League+ perks are activated with promo codes for the period stated when the code is issued. Perks are cosmetic or convenience features, they may change over time, and they have no cash value. Codes cannot be exchanged for money.</p>
        <h2>5. Discord channel messages</h2>
        <p>League admins may connect a Discord webhook. Dotadle will then post game results of league members (name, number of attempts, points, streak) to that channel. Admins must have permission to add webhooks in that server.</p>
        <h2>6. Availability</h2>
        <p>The Service is provided “as is” and “as available”, without warranties of any kind. We may change, suspend or discontinue any part of it at any time. Scores and progress may be reset.</p>
        <h2>7. Liability</h2>
        <p>To the maximum extent permitted by law, the developer is not liable for any indirect or consequential damages arising from your use of the Service.</p>
        <h2>8. Changes and contact</h2>
        <p>We may update these Terms; the date above shows the latest version. Continued use means you accept the changes. Questions: <Contact lang="en" />.</p>
      </>}
      ru={<>
        <p>Эти условия регулируют использование Dotadle (сайта и Discord Activity, далее «Сервис»). Пользуясь Сервисом, вы соглашаетесь с ними.</p>
        <h2>1. Сервис</h2>
        <p>Dotadle — бесплатная фанатская игра-угадайка о героях Dota 2: ежедневные загадки, гонки с друзьями, рейтинги и лиги. Dotadle не связан с Valve Corporation и не одобрен ею. Dota 2, имена и изображения героев принадлежат Valve Corporation.</p>
        <h2>2. Аккаунты</h2>
        <p>Вход выполняется через Discord или Google. Вам должно быть не меньше минимального возраста, который требуют Discord и Google в вашей стране (не меньше 13 лет). Вы отвечаете за действия в своём аккаунте.</p>
        <h2>3. Правила</h2>
        <p>Запрещено жульничать, автоматизировать попытки, использовать ошибки, атаковать или перегружать Сервис, выдавать себя за других и использовать оскорбительные ники. Админы лиг и турниров отвечают за то, что добавляют сами: названия лиг и турниров, ссылки спонсоров. При нарушении правил мы можем удалить контент, обнулить очки или закрыть доступ.</p>
        <h2>4. Плюшки саппортеров и промокоды</h2>
        <p>Поддержка проекта добровольна. «Саппортер» и «Лига+» активируются промокодами на срок, указанный при выдаче кода. Это косметические и удобные функции: они могут меняться и не имеют денежной стоимости. Коды нельзя обменять на деньги.</p>
        <h2>5. Сообщения в Discord-канал</h2>
        <p>Админ лиги может подключить вебхук Discord. Тогда Dotadle будет публиковать в канал результаты игроков лиги: имя, число попыток, очки, серию. У админа должно быть право добавлять вебхуки на этом сервере.</p>
        <h2>6. Доступность</h2>
        <p>Сервис предоставляется «как есть», без каких-либо гарантий. Мы можем в любой момент менять, приостанавливать или закрывать любую его часть. Очки и прогресс могут быть сброшены.</p>
        <h2>7. Ответственность</h2>
        <p>В пределах, допустимых законом, разработчик не несёт ответственности за косвенный ущерб от использования Сервиса.</p>
        <h2>8. Изменения и связь</h2>
        <p>Условия могут обновляться, дата выше показывает актуальную версию. Продолжая пользоваться Сервисом, вы принимаете изменения. Вопросы: <Contact lang="ru" />.</p>
      </>}
    />
  );
}
