import * as MessagesFlows from "@cogs/cores/messagesFlows";
import * as Random from "random-js";
import * as getLogger from "loggy";
import * as utils from "@utils/utils";
import * as i18n from "@utils/ez-i18n";
import { IModule } from "@sb-types/ModuleLoader/Interfaces";
import { Plugin } from "@cogs/plugin";
import { Message, GuildMember } from "discord.js";
import { command } from "@utils/help";
import { IHashMap } from "@sb-types/Types";

const ICONS = {
	THINKING: "https://i.imgur.com/hIuSpIl.png",
	RESPONSE: "https://twemoji.maxcdn.com/72x72/1f3b1.png"
};

interface I8BallResponsesCategory {
	color: number;
	variants: string[];
}

@command("FUN", "8ball", "loc:8BALL_META_DEFAULT", {
	"loc:8BALL_META_DEFAULT_ARG0": {
		optional: false,
		description: "loc:8BALL_META_DEFAULT_ARG0_DESC"
	}
})
class Ball8 extends Plugin implements IModule {
	public get signature() {
		return "snowball.features.8ball";
	}

	private readonly _log = getLogger("8Ball");
	private readonly _responses: IHashMap<I8BallResponsesCategory> = {
		"affirmative": {
			color: 0x2196F3,
			variants: [
				"8BALL_ANSWER_CERTAIN", "8BALL_ANSWER_DECIDEDLY", "8BALL_ANSWER_WODOUBT",
				"8BALL_ANSWER_DEFINITELY", "8BALL_ANSWER_RELY"
			]
		},
		"non-committal": {
			color: 0x4CAF50,
			variants: [
				"8BALL_ANSWER_NC_PROB", "8BALL_ANSWER_NC_MOSTLIKELY", "8BALL_ANSWER_NC_OUTLOOK",
				"8BALL_ANSWER_NC_SIGNS", "8BALL_ANSWER_NC_YES"
			]
		},
		"neutral": {
			color: 0xFFC107,
			variants: [
				"8BALL_ANSWER_NEUTRAL_HAZY", "8BALL_ANSWER_NEUTRAL_LATER", "8BALL_ANSWER_NEUTRAL_NOT",
				"8BALL_ANSWER_NEUTRAL_CANTPREDICT", "8BALL_ANSWER_NEUTRAL_CONCENTRATE"
			]
		},
		"negative": {
			color: 0xe53935,
			variants: [
				"8BALL_ANSWER_NEGATIVE_DONT", "8BALL_ANSWER_NEGATIVE_MYREPLY", "8BALL_ANSWER_NEGATIVE_SOURCES",
				"8BALL_ANSWER_NEGATIVE_OUTLOOK", "8BALL_ANSWER_NEGATIVE_DOUBTFUL"
			]
		}
	};
	private readonly _categories = Object.keys(this._responses);
	private _flowHandler: MessagesFlows.IPublicFlowCommand;
	private _i18nKeys: string[];

	constructor() {
		super({}, true);
		this._log("ok", "8Ball is loading...");
	}

	public async init() {
		if (!$modLoader.isPendingInitialization(this.signature)) {
			throw new Error("This module is not pending initialization");
		}

		const messagesFlowsKeeper = $snowball.modLoader.findKeeper<MessagesFlows.MessagesFlows>("snowball.core_features.messageflows");
		if (!messagesFlowsKeeper) { throw new Error("`MessageFlows` not found!"); }

		this._i18nKeys = await $localizer.extendLanguages(
			await $localizer.fileLoader.directoryToLanguagesTree(
				[__dirname, "i18n"]
			)
		);

		messagesFlowsKeeper.onInit((flowsMan: MessagesFlows.default) => {
			return this._flowHandler = flowsMan.watchForCommands(
				(ctx) => this.onMessage(ctx),
				"8ball"
			);
		});
	}

	private async onMessage(ctx: MessagesFlows.IMessageFlowContext) {
		const msg = ctx.message;

		const i18nTarget = await utils.getMessageMemberOrAuthor(msg);
		if (!i18nTarget) { return; }

		const actualUser = i18nTarget instanceof GuildMember ? i18nTarget.user : i18nTarget;

		const random = new Random(Random.engines.mt19937().autoSeed());

		const localName = await i18n.localizeForUser(i18nTarget, "8BALL_NAME");

		let message: Message;
		try {
			message = <Message> await msg.channel.send({
				embed: await i18n.generateLocalizedEmbed(utils.EmbedType.Empty, i18nTarget, "8BALL_THINKING", {
					author: {
						name: localName,
						icon_url: ICONS.THINKING
					},
					clearFooter: true
				})
			});
		} catch (err) {
			this._log("err", "Damn! 8Ball can't send message", err);
			$snowball.captureException(err, {
				extra: { channelId: msg.channel.id }
			});

			return;
		}

		await utils.sleep(random.integer(1500, 3000));

		const categoryName = random.pick<string>(this._categories);
		const category = this._responses[categoryName];

		const answer = random.pick<string>(category.variants);

		try {
			await message.edit("", {
				embed: await i18n.generateLocalizedEmbed(utils.EmbedType.Empty, i18nTarget, answer, {
					author: {
						icon_url: ICONS.RESPONSE,
						name: localName
					},
					color: category.color,
					footer: {
						text: await i18n.localizeForUser(i18nTarget, "8BALL_INREPLY", {
							username: i18nTarget instanceof GuildMember ? i18nTarget.displayName : i18nTarget.username
						}),
						icon_url: actualUser.displayAvatarURL({ format: "webp", size: 128 })
					}
				})
			});
		} catch (err) {
			$snowball.captureException(err, { extra: { id: message.id } });

			this._log("err", "Bummer! We cannot update the message, trying to delete our message", err);

			try {
				await message.delete();
			} catch (err) {
				this._log("err", "Message also cannot be removed...", err);
				$snowball.captureException(err, { extra: { id: message.id } });
			}
		}
	}

	public async unload() {
		if (!$modLoader.isPendingUnload(this.signature)) {
			throw new Error("This module is not pending unload");
		}

		if (this._flowHandler) {
			this._flowHandler.unhandle();
		}

		if (this._i18nKeys) { $localizer.pruneLanguages(this._i18nKeys); }

		this.unhandleEvents();

		return true;
	}
}

module.exports = Ball8;
