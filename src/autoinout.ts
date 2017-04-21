/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ben Crowl. All rights reserved.
 *  Original Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { workspace, Disposable } from 'vscode';
import { HgErrorCodes, HgError } from "./hg";
import { Model } from './model';
import { throttle } from './decorators';

export class AutoIncomingOutgoing {

	private static Period = 3 * 60 * 1000 /* three minutes */;
	private disposables: Disposable[] = [];
	private timer: NodeJS.Timer;

	constructor(private model: Model) {
		workspace.onDidChangeConfiguration(this.onConfiguration, this, this.disposables);
		this.model.onDidChangeHgrc(this.onConfiguration, this, this.disposables);
		this.onConfiguration();
	}

	private onConfiguration(): void {
		const hgConfig = workspace.getConfiguration('hg');

		if (hgConfig.get<boolean>('autoInOut') === false) {
			this.disable();
		}
		else {
			this.enable();
		}
	}

	enable(): void {
		if (this.timer) {
			return;
		}

		setTimeout(() => this.refresh(), 3000); // delay to let first status run before
		this.timer = setInterval(() => this.refresh(), AutoIncomingOutgoing.Period);
	}

	disable(): void {
		clearInterval(this.timer);
	}

	@throttle
	private async refresh(): Promise<void> {
		try {
			await this.model.countIncomingOutgoing();
		}
		catch (err) {
			if (err instanceof HgError && (
				err.hgErrorCode === HgErrorCodes.AuthenticationFailed ||
				err.hgErrorCode === HgErrorCodes.RepositoryIsUnrelated ||
				err.hgErrorCode === HgErrorCodes.RepositoryDefaultNotFound)) {
				this.disable();
			}
		}
	}

	dispose(): void {
		this.disable();
		this.disposables.forEach(d => d.dispose());
	}
}
